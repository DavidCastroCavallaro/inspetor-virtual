// Projeto ativo (isola lista/capturas/resultados). Persistido em localStorage.
const KEY = 'iv_active_project';
let listeners = [];

export function getActiveProjectId() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setActiveProjectId(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((f) => f(id || ''));
}

export function onProjectChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}
