import { getActiveProjectId } from './project.js';
import { localApi, getApiKey, setApiKey } from './localApi.js';

export const STANDALONE = import.meta.env.VITE_STANDALONE === 'true';
export { getApiKey, setApiKey };

const BASE = '/api';

async function j(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      'X-Project-Id': getActiveProjectId(),
    },
    ...opts,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

function withProject(url) {
  const pid = getActiveProjectId();
  return pid ? `${url}?projectId=${encodeURIComponent(pid)}` : url;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const serverApi = {
  health: () => j('/health'),

  listProjects: () => j('/projects'),
  createProject: (nome) => j('/projects', { method: 'POST', body: JSON.stringify({ nome }) }),
  deleteProject: (id) => j(`/projects/${id}`, { method: 'DELETE' }),

  importExpected: (base64) => j('/expected/import', { method: 'POST', body: JSON.stringify({ base64 }) }),
  getExpected: () => j('/expected'),
  process: (captures) => j('/process', { method: 'POST', body: JSON.stringify({ captures }) }),
  getResults: () => j('/results'),
  auditResult: (id, payload) => j(`/results/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  reset: () => j('/reset', { method: 'POST' }),

  exportXlsx: async () => saveBlob(await (await fetch(withProject(BASE + '/export/xlsx'))).blob(), 'inventario_final.xlsx'),
  exportPdf: async () => saveBlob(await (await fetch(withProject(BASE + '/export/pdf'))).blob(), 'relatorio_executivo.pdf'),
};

const standaloneApi = {
  ...localApi,
  exportXlsx: async () => saveBlob(await localApi.exportXlsxBlob(), 'inventario_final.xlsx'),
  exportPdf: async () => saveBlob(await localApi.exportPdfBlob(), 'relatorio_executivo.pdf'),
};

export const api = STANDALONE ? standaloneApi : serverApi;

export async function pingOnline() {
  if (STANDALONE) return navigator.onLine;
  try {
    await fetch(BASE + '/health', { cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}
