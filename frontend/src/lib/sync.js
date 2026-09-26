import { db, expectedKey } from '../db.js';
import { api, pingOnline } from './api.js';
import { getActiveProjectId } from './project.js';

// Envia a fila local (IndexedDB) do projeto ativo -> backend, em lote leve.
export async function syncPending(onProgress = () => {}) {
  const pid = getActiveProjectId();
  if (!pid) return { ok: false, reason: 'no-project' };

  const online = await pingOnline();
  if (!online) return { ok: false, reason: 'offline' };

  const pend = await db.captures
    .where('status').anyOf('pendente', 'erro')
    .filter((c) => c.projectId === pid)
    .toArray();
  if (!pend.length) return { ok: true, processed: 0 };

  const payload = pend.map((c) => ({
    id: c.id,
    hintCodigo: c.hintCodigo || null,
    imageBase64: c.imageBase64,
    imageMime: c.imageMime || 'image/jpeg',
    audioBase64: c.audioBase64 || null,
    audioMime: c.audioMime || 'audio/webm',
    observacao: c.observacao || '',
    estadoConservacao: c.estadoConservacao || null,
    localizacao: c.localizacao || '',
    capturedAt: c.capturedAt,
  }));

  onProgress({ phase: 'enviando', count: payload.length });

  try {
    const { processed } = await api.process(payload);
    for (const r of processed) {
      await db.results.put({ ...r, projectId: pid });
      await db.captures.update(r.id, { status: 'sincronizado' });
    }
    onProgress({ phase: 'concluido', count: processed.length });
    return { ok: true, processed: processed.length };
  } catch (e) {
    for (const c of pend) await db.captures.update(c.id, { status: 'erro' });
    return { ok: false, reason: String(e.message || e) };
  }
}

export async function refreshExpectedFromServer() {
  const pid = getActiveProjectId();
  if (!pid) return [];
  try {
    const { expected } = await api.getExpected();
    await db.expected.where('projectId').equals(pid).delete();
    if (expected?.length)
      await db.expected.bulkPut(expected.map((e) => ({ ...e, projectId: pid, key: expectedKey(pid, e.codigo) })));
    return expected || [];
  } catch {
    return db.expected.where('projectId').equals(pid).toArray();
  }
}

export async function refreshResultsFromServer() {
  const pid = getActiveProjectId();
  if (!pid) return [];
  try {
    const { results } = await api.getResults();
    await db.results.where('projectId').equals(pid).delete();
    if (results?.length) await db.results.bulkPut(results.map((r) => ({ ...r, projectId: pid })));
    return results || [];
  } catch {
    return db.results.where('projectId').equals(pid).toArray();
  }
}

// limpa o cache local (IndexedDB) de um projeto - usado ao deletar
export async function wipeLocalProject(pid) {
  if (!pid) return;
  await db.expected.where('projectId').equals(pid).delete();
  await db.captures.where('projectId').equals(pid).delete();
  await db.results.where('projectId').equals(pid).delete();
}
