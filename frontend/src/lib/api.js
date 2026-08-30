import { getActiveProjectId } from './project.js';

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

export const api = {
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

  exportXlsxUrl: () => withProject(BASE + '/export/xlsx'),
  exportPdfUrl: () => withProject(BASE + '/export/pdf'),
};

export async function pingOnline() {
  try {
    await fetch(BASE + '/health', { cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}
