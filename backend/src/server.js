import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { config, isMock, visionProvider } from './config.js';
import { load, save, reset, bucket, projectExists } from './store.js';
import { parseExpectedXlsx, buildInventoryXlsx } from './excel.js';
import { transcribeAudio, extractFromPlate } from './ai.js';
import { matchAsset } from './matcher.js';
import { evaluate } from './evaluator.js';
import { buildReportPdf } from './report.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

// projeto ativo vem no header X-Project-Id (ou ?projectId= p/ links de download)
app.use((req, _res, next) => {
  req.pid = String(req.header('x-project-id') || req.query.projectId || '').trim();
  next();
});
// exige projeto valido
function needProject(req, res) {
  const db = load();
  if (!projectExists(db, req.pid)) {
    fail(res, 400, 'Selecione ou crie um projeto');
    return null;
  }
  return db;
}

/* ---------- health / modo ---------- */
app.get('/api/health', (_req, res) => {
  ok(res, {
    mode: isMock() ? 'mock' : 'live',
    visionProvider: isMock() ? 'mock' : visionProvider(),
    whisper: config.openai.key ? 'whisper-1' : 'mock',
    confidenceThreshold: config.confidenceThreshold,
  });
});

/* ---------- MODULO 0: projetos ---------- */
app.get('/api/projects', (_req, res) => {
  const db = load();
  const projects = db.projects.map((p) => {
    const b = db.byProject[p.id] || {};
    return {
      ...p,
      counts: {
        expected: (b.expected || []).length,
        captures: (b.captures || []).length,
        results: (b.results || []).length,
      },
    };
  });
  ok(res, { projects });
});

app.post('/api/projects', (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (!nome) return fail(res, 400, 'Informe o nome do projeto');
  const db = load();
  if (db.projects.some((p) => p.nome.toLowerCase() === nome.toLowerCase()))
    return fail(res, 409, 'Já existe um projeto com esse nome');
  const project = { id: randomUUID(), nome, createdAt: new Date().toISOString() };
  db.projects.push(project);
  db.byProject[project.id] = { expected: [], captures: [], results: [] };
  save(db);
  ok(res, { project });
});

// apaga o projeto e TODOS os dados dele da memoria da API
app.delete('/api/projects/:id', (req, res) => {
  const db = load();
  const id = req.params.id;
  if (!db.projects.some((p) => p.id === id)) return fail(res, 404, 'Projeto não encontrado');
  db.projects = db.projects.filter((p) => p.id !== id);
  delete db.byProject[id];
  save(db);
  ok(res, {});
});

/* ---------- MODULO 1: lista previa ---------- */
app.post('/api/expected/import', (req, res) => {
  const db = needProject(req, res);
  if (!db) return;
  try {
    const { base64 } = req.body || {};
    if (!base64) return fail(res, 400, 'Envie { base64 } do arquivo .xlsx');
    const expected = parseExpectedXlsx(Buffer.from(base64, 'base64'));
    bucket(db, req.pid).expected = expected;
    save(db);
    ok(res, { count: expected.length, expected });
  } catch (e) {
    fail(res, 400, 'Falha ao ler planilha: ' + e.message);
  }
});

app.get('/api/expected', (req, res) => {
  const db = load();
  ok(res, { expected: bucket(db, req.pid).expected });
});

/* ---------- MODULO 3: pipeline de IA ---------- */
app.post('/api/process', async (req, res) => {
  const db = needProject(req, res);
  if (!db) return;
  const d = bucket(db, req.pid);
  const captures = Array.isArray(req.body?.captures) ? req.body.captures : [];
  if (!captures.length) return fail(res, 400, 'Nenhuma captura recebida');

  let npSeq = d.results.filter((r) => r.status === 'novo').length;
  const processed = [];

  for (const cap of captures) {
    const { text: sttText, provider: sttProvider } =
      await transcribeAudio(cap.audioBase64, cap.audioMime);
    // nota do perito p/ IA: audio transcrito + texto digitado (o que houver)
    const transcript = [sttText, cap.observacao].filter(Boolean).join(' — ').trim();

    const hintObj = cap.hintCodigo
      ? d.expected.find((e) => String(e.codigo).toLowerCase() === String(cap.hintCodigo).toLowerCase())
      : null;

    const extracted = await extractFromPlate({
      imageBase64: cap.imageBase64,
      mime: cap.imageMime || 'image/jpeg',
      transcript,
      hint: hintObj ? { expected: hintObj } : null,
    });

    const m = matchAsset(extracted, d.expected, cap.hintCodigo);
    const codigo = m.matched?.codigo || `NP-${String(++npSeq).padStart(3, '0')}`;
    const descricao = m.matched?.descricao || `${extracted.fabricante} ${extracted.modelo}`.trim() || 'Ativo não cadastrado';
    const localizacao = m.matched?.localizacao || cap.localizacao || '';

    const ev = evaluate({
      descricao,
      anoFabricacao: extracted.anoFabricacao,
      condicao: extracted.condicao,
    });

    const row = {
      id: cap.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      capturedAt: cap.capturedAt || new Date().toISOString(),
      codigo,
      status: m.status,
      statusLabel: m.statusLabel,
      descricao,
      localizacao,
      fabricante: extracted.fabricante || '',
      modelo: extracted.modelo || '',
      potencia: extracted.potencia || '',
      rpm: extracted.rpm || '',
      voltagem: extracted.voltagem || '',
      numeroSerie: extracted.numeroSerie || '',
      condicao: extracted.condicao || 'Regular',
      anoFabricacao: extracted.anoFabricacao || '',
      confianca: extracted.confianca ?? null,
      divergencias: m.divergencias,
      cadastro: m.matched || null,
      transcript,
      observacao: cap.observacao || transcript || '',
      ai: { visionProvider: extracted.provider, sttProvider, routedFallback: !!extracted.routedFallback },
      ...ev,
      auditado: false,
      decisao: null,
    };
    d.results = d.results.filter((r) => r.id !== row.id);
    d.results.push(row);
    processed.push(row);
  }

  save(db);
  ok(res, { processed });
});

app.get('/api/results', (req, res) => {
  const db = load();
  ok(res, { results: bucket(db, req.pid).results });
});

/* ---------- MODULO 4: auditoria ---------- */
app.put('/api/results/:id', (req, res) => {
  const db = needProject(req, res);
  if (!db) return;
  const d = bucket(db, req.pid);
  const r = d.results.find((x) => x.id === req.params.id);
  if (!r) return fail(res, 404, 'Resultado não encontrado');
  const { decisao, patch } = req.body || {};

  if (decisao === 'aceitar_ia') {
    r.status = 'confirmado';
    r.statusLabel = 'Confirmado (IA aceita)';
    r.divergencias = [];
  } else if (decisao === 'manter_cadastro' && r.cadastro) {
    Object.assign(r, {
      fabricante: r.cadastro.fabricante, modelo: r.cadastro.modelo,
      potencia: r.cadastro.potencia, rpm: r.cadastro.rpm, voltagem: r.cadastro.voltagem,
      status: 'confirmado', statusLabel: 'Confirmado (cadastro mantido)', divergencias: [],
    });
  }
  if (patch && typeof patch === 'object') Object.assign(r, patch);

  Object.assign(r, evaluate({ descricao: r.descricao, anoFabricacao: r.anoFabricacao, condicao: r.condicao }));
  r.auditado = true;
  r.decisao = decisao || r.decisao;
  save(db);
  ok(res, { result: r });
});

/* ---------- exportacoes ---------- */
app.get('/api/export/xlsx', (req, res) => {
  const db = load();
  const buf = buildInventoryXlsx(bucket(db, req.pid).results);
  res.setHeader('Content-Disposition', 'attachment; filename="inventario_final.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.get('/api/export/pdf', (req, res) => {
  const db = load();
  res.setHeader('Content-Disposition', 'attachment; filename="relatorio_executivo.pdf"');
  res.setHeader('Content-Type', 'application/pdf');
  buildReportPdf(bucket(db, req.pid).results, res);
});

// reset: projeto ativo (se informado) OU tudo
app.post('/api/reset', (req, res) => {
  if (req.pid) {
    const db = load();
    if (db.byProject[req.pid]) db.byProject[req.pid] = { expected: [], captures: [], results: [] };
    save(db);
    return ok(res, { scope: 'project' });
  }
  reset();
  ok(res, { scope: 'all' });
});

app.listen(config.port, () => {
  console.log(`[Inspetor Virtual] API  http://localhost:${config.port}`);
  console.log(`[Inspetor Virtual] Modo ${isMock() ? 'MOCK (custo zero)' : 'LIVE (' + visionProvider() + ')'}`);
});
