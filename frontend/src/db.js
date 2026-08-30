import Dexie from 'dexie';

// Banco novo (multiprojeto). O nome mudou de 'inspetor_virtual' p/ evitar
// qualquer erro de migracao de schema antigo — o servidor e a fonte da verdade.
Dexie.delete('inspetor_virtual').catch(() => {});

export const db = new Dexie('inspetor_virtual_mp');

db.version(1).stores({
  // dados isolados por projeto via campo projectId
  projects: 'id, nome, createdAt',
  expected: 'key, projectId, codigo',        // key = `${projectId}|${codigo}`
  captures: 'id, projectId, status, capturedAt',
  results: 'id, projectId, codigo, status, auditado',
  kv: 'k',
});

export const expectedKey = (projectId, codigo) => `${projectId}|${codigo}`;

export async function setKV(k, v) { await db.kv.put({ k, v }); }
export async function getKV(k, def = null) {
  const row = await db.kv.get(k);
  return row ? row.v : def;
}
