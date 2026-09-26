import { config, isMock, visionProvider } from './config.js';

/* ============ PROMPT ENXUTO (strict JSON, sem conversa) ============ */
const SYSTEM_PROMPT =
  'Voce e um agente de OCR industrial e de avaliacao de ativos. Leia a placa do equipamento na imagem, ' +
  'a nota de voz do perito e a descricao do cadastro (se houver). ' +
  'Responda SOMENTE com JSON valido, sem markdown, sem texto extra. Campos ausentes = "". ' +
  'Schema: {"fabricante":"","modelo":"","potencia":"","rpm":"","voltagem":"","numeroSerie":"","condicao":"Bom|Regular|Ruim","anoFabricacao":"","vidaUtilAnos":0,"confianca":0.0}. ' +
  'confianca = 0..1 (qualidade da leitura da placa). ' +
  'vidaUtilAnos = sua estimativa da vida util normal (anos) desse tipo/porte de equipamento industrial, ' +
  'com base em pratica usual de avaliacao de maquinas e equipamentos (ex.: motor eletrico ~20, transformador ~25-40, ' +
  'compressor ~20, bomba ~15, caldeira ~25-30); 0 se nao souber estimar.';

function userText(transcript, hint) {
  const cadastro = hint?.expected
    ? ` Cadastro esperado para este ativo: ${[hint.expected.descricao, hint.expected.fabricante, hint.expected.modelo].filter(Boolean).join(' / ')}.`
    : '';
  return `Nota de voz do perito: "${transcript || '(sem audio)'}".${cadastro} Extraia os dados da placa e estime a vida util.`;
}

/* ============ TRANSCRICAO DE VOZ ============ */
export async function transcribeAudio(base64, mime = 'audio/webm') {
  if (!base64) return { text: '', provider: 'none' };
  if (isMock() || !config.openai.key) {
    return { text: mockTranscript(), provider: 'mock' };
  }
  const bin = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([bin], { type: mime }), 'audio.webm');
  form.append('model', config.openai.whisper);
  form.append('language', 'pt');
  form.append('response_format', 'text');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.key}` },
    body: form,
  });
  if (!r.ok) return { text: mockTranscript(), provider: 'mock-fallback', error: await r.text() };
  const text = (await r.text()).trim();
  return { text, provider: 'whisper' };
}

/* ============ EXTRACAO MULTIMODAL (1 unica chamada) ============ */
export async function extractFromPlate({ imageBase64, mime = 'image/jpeg', transcript, hint }) {
  if (isMock()) return mockExtract(transcript, hint);

  const provider = visionProvider();
  let out;
  try {
    out = provider === 'anthropic'
      ? await callAnthropic(config.anthropic.fast, imageBase64, mime, transcript, hint)
      : await callGemini(config.gemini.fast, imageBase64, mime, transcript, hint);
  } catch (e) {
    return { ...mockExtract(transcript, hint), provider: 'mock-fallback', error: String(e) };
  }

  // Smart routing: confianca baixa -> fallback modelo maior (1x)
  if ((out.confianca ?? 0) < config.confidenceThreshold) {
    try {
      const fb = config.anthropic.key
        ? await callAnthropic(config.anthropic.fallback, imageBase64, mime, transcript, hint)
        : await callGemini(config.gemini.fallback, imageBase64, mime, transcript, hint);
      fb.routedFallback = true;
      return fb;
    } catch { /* mantem resultado rapido */ }
  }
  return out;
}

/* ---- Gemini ---- */
async function callGemini(model, imageBase64, mime, transcript, hint) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.gemini.key}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [
        { text: userText(transcript, hint) },
        { inline_data: { mime_type: mime, data: imageBase64 } },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 350, responseMimeType: 'application/json' },
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return { ...safeJson(txt), provider: `gemini:${model}` };
}

/* ---- Anthropic ---- */
async function callAnthropic(model, imageBase64, mime, transcript, hint) {
  const body = {
    model,
    max_tokens: 350,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
        { type: 'text', text: userText(transcript, hint) },
      ],
    }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropic.key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.content?.[0]?.text || '{}';
  return { ...safeJson(txt), provider: `anthropic:${model}` };
}

function safeJson(t) {
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : '{}'); } catch { return {}; }
}

/* ============ MOCK INTELIGENTE ============ */
const MOCK_POOL = [
  { fabricante: 'WEG', modelo: 'W22 IR3 Premium', potencia: '15 cv', rpm: '3540', voltagem: '380/660 V', anoFabricacao: '2016' },
  { fabricante: 'WEG', modelo: 'W21', potencia: '10 cv', rpm: '1760', voltagem: '220/380 V', anoFabricacao: '2012' },
  { fabricante: 'Siemens', modelo: '1LE0', potencia: '20 cv', rpm: '1780', voltagem: '380 V', anoFabricacao: '2018' },
  { fabricante: 'Atlas Copco', modelo: 'GA 30', potencia: '40 cv', rpm: '2970', voltagem: '440 V', anoFabricacao: '2010' },
  { fabricante: 'Toshiba', modelo: 'EQP Global', potencia: '25 cv', rpm: '3550', voltagem: '460 V', anoFabricacao: '2020' },
];

function hashNum(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockTranscript() {
  const opts = [
    'Motor operando normal, sem ruido anormal, pintura ok.',
    'Rolamento com ruido leve, recomendo acompanhamento, vazamento de graxa.',
    'Equipamento parado, carcaca oxidada, ventilador quebrado, condicao ruim.',
    'Placa parcialmente ilegivel, muita sujeira, precisa limpeza.',
  ];
  return opts[Date.now() % opts.length];
}

export function mockExtract(transcript, hint) {
  const t = (transcript || '').toLowerCase();
  let condicao = 'Bom';
  if (/ruin|oxidad|quebrad|parado|trincad|grave/.test(t)) condicao = 'Ruim';
  else if (/ruido|vazamento|leve|acompanhamento|desgaste|sujeira/.test(t)) condicao = 'Regular';

  // hint = codigo esperado -> devolve dados coerentes com o cadastro (com pequena divergencia)
  if (hint && hint.expected) {
    const e = hint.expected;
    const diverge = hashNum(e.codigo) % 3 === 0;
    return {
      fabricante: e.fabricante || 'WEG',
      modelo: e.modelo || 'W22',
      potencia: diverge ? bumpPotencia(e.potencia) : (e.potencia || '15 cv'),
      rpm: e.rpm || '3540',
      voltagem: e.voltagem || '380 V',
      numeroSerie: 'SN-' + (hashNum(e.codigo) % 900000 + 100000),
      condicao,
      anoFabricacao: e.ano || '2015',
      confianca: 0.93,
      provider: 'mock',
    };
  }

  const seed = hashNum((transcript || '') + Date.now());
  const base = MOCK_POOL[seed % MOCK_POOL.length];
  const lowConf = /ilegivel|sujeira|limpeza|parcial/.test(t);
  return {
    ...base,
    numeroSerie: 'SN-' + (seed % 900000 + 100000),
    condicao,
    confianca: lowConf ? 0.62 : 0.88,
    provider: 'mock',
  };
}

function bumpPotencia(p) {
  const m = String(p || '').match(/(\d+([.,]\d+)?)/);
  if (!m) return '20 cv';
  const n = parseFloat(m[1].replace(',', '.'));
  return String(p).replace(m[1], String(Math.round(n * 1.25)));
}
