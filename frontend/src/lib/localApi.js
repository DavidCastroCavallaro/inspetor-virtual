/* Orquestrador STANDALONE — mesma forma da api.js "de servidor", mas tudo
   rodando no navegador (IndexedDB + chamada direta a Anthropic). Espelha as
   rotas do backend/src/server.js sem precisar de Node/Docker/WSL. */
import { db, expectedKey } from '../db.js';
import { getActiveProjectId } from './project.js';
import { parseExpectedXlsx, buildInventoryXlsxBlob } from './localExcel.js';
import { buildReportPdfBlob } from './localPdf.js';
import { extractFromPlate } from './localAi.js';
import { matchAsset } from './localMatcher.js';
import { evaluate } from './localEvaluator.js';

const nanoid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function getApiKey() {
  const row = await db.kv.get('anthropicApiKey');
  return row?.v || '';
}
export async function setApiKey(key) {
  await db.kv.put({ k: 'anthropicApiKey', v: String(key || '').trim() });
}

export const localApi = {
  health: async () => {
    const key = await getApiKey();
    return {
      mode: key ? 'live' : 'mock',
      visionProvider: key ? 'anthropic' : 'mock',
      whisper: 'navegador',
      confidenceThreshold: 0.8,
    };
  },

  listProjects: async () => {
    const projects = await db.projects.toArray();
    const withCounts = await Promise.all(projects.map(async (p) => ({
      ...p,
      counts: {
        expected: await db.expected.where('projectId').equals(p.id).count(),
        captures: await db.captures.where('projectId').equals(p.id).count(),
        results: await db.results.where('projectId').equals(p.id).count(),
      },
    })));
    return { projects: withCounts };
  },

  createProject: async (nomeRaw) => {
    const nome = String(nomeRaw || '').trim();
    if (!nome) throw new Error('Informe o nome do projeto');
    const existing = await db.projects.toArray();
    if (existing.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error('Já existe um projeto com esse nome');
    }
    const project = { id: nanoid(), nome, createdAt: new Date().toISOString() };
    await db.projects.put(project);
    return { project };
  },

  deleteProject: async (id) => {
    await db.projects.delete(id);
    await db.expected.where('projectId').equals(id).delete();
    await db.captures.where('projectId').equals(id).delete();
    await db.results.where('projectId').equals(id).delete();
    return {};
  },

  importExpected: async (base64) => {
    const pid = getActiveProjectId();
    if (!pid) throw new Error('Selecione ou crie um projeto');
    const expected = parseExpectedXlsx(base64ToArrayBuffer(base64));
    await db.expected.where('projectId').equals(pid).delete();
    await db.expected.bulkPut(expected.map((e) => ({ ...e, projectId: pid, key: expectedKey(pid, e.codigo) })));
    return { count: expected.length, expected };
  },

  getExpected: async () => {
    const pid = getActiveProjectId();
    if (!pid) return { expected: [] };
    return { expected: await db.expected.where('projectId').equals(pid).toArray() };
  },

  process: async (captures) => {
    const pid = getActiveProjectId();
    if (!pid) throw new Error('Selecione ou crie um projeto');
    if (!captures?.length) throw new Error('Nenhuma captura recebida');

    const apiKey = await getApiKey();
    const expected = await db.expected.where('projectId').equals(pid).toArray();
    const existingResults = await db.results.where('projectId').equals(pid).toArray();
    let npSeq = existingResults.filter((r) => r.status === 'novo').length;
    const processed = [];

    for (const cap of captures) {
      // standalone: sem Whisper — a nota de voz ja chega como texto (fala ao vivo do navegador ou digitada)
      const transcript = String(cap.observacao || '').trim();

      const hintObj = cap.hintCodigo
        ? expected.find((e) => String(e.codigo).toLowerCase() === String(cap.hintCodigo).toLowerCase())
        : null;

      const extracted = await extractFromPlate({
        imageBase64: cap.imageBase64,
        mime: cap.imageMime || 'image/jpeg',
        transcript,
        hint: hintObj ? { expected: hintObj } : null,
        apiKey,
      });

      const m = matchAsset(extracted, expected, cap.hintCodigo);
      const codigo = m.matched?.codigo || `NP-${String(++npSeq).padStart(3, '0')}`;
      const descricao = m.matched?.descricao || `${extracted.fabricante} ${extracted.modelo}`.trim() || 'Ativo não cadastrado';
      const localizacao = m.matched?.localizacao || cap.localizacao || '';

      const ev = evaluate({ descricao, anoFabricacao: extracted.anoFabricacao, condicao: extracted.condicao });

      const row = {
        id: cap.id || nanoid(),
        capturedAt: cap.capturedAt || new Date().toISOString(),
        codigo,
        patrimonio: m.matched?.patrimonio || '',
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
        ai: { visionProvider: extracted.provider, sttProvider: 'navegador', routedFallback: !!extracted.routedFallback },
        ...ev,
        auditado: false,
        decisao: null,
        projectId: pid,
      };
      await db.results.put(row);
      processed.push(row);
    }
    return { processed };
  },

  getResults: async () => {
    const pid = getActiveProjectId();
    if (!pid) return { results: [] };
    return { results: await db.results.where('projectId').equals(pid).toArray() };
  },

  auditResult: async (id, payload) => {
    const r = await db.results.get(id);
    if (!r) throw new Error('Resultado não encontrado');
    const { decisao, patch } = payload || {};

    if (decisao === 'aceitar_ia') {
      r.status = 'confirmado'; r.statusLabel = 'Confirmado (IA aceita)'; r.divergencias = [];
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
    await db.results.put(r);
    return { result: r };
  },

  reset: async () => {
    const pid = getActiveProjectId();
    if (pid) {
      await db.expected.where('projectId').equals(pid).delete();
      await db.captures.where('projectId').equals(pid).delete();
      await db.results.where('projectId').equals(pid).delete();
    }
    return {};
  },

  exportXlsxBlob: async () => {
    const pid = getActiveProjectId();
    const results = pid ? await db.results.where('projectId').equals(pid).toArray() : [];
    return buildInventoryXlsxBlob(results);
  },
  exportPdfBlob: async () => {
    const pid = getActiveProjectId();
    const results = pid ? await db.results.where('projectId').equals(pid).toArray() : [];
    return buildReportPdfBlob(results);
  },
};
