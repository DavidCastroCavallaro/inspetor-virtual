import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Dados isolados por projeto: byProject[projectId] = { expected, captures, results }
const empty = { projects: [], byProject: {}, meta: { updatedAt: null } };

export function load() {
  if (!existsSync(DB_FILE)) return structuredClone(empty);
  try {
    const raw = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    return { ...structuredClone(empty), ...raw };
  } catch {
    return structuredClone(empty);
  }
}

export function save(db) {
  db.meta.updatedAt = new Date().toISOString();
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return db;
}

export function reset() {
  return save(structuredClone(empty));
}

// Retorna (criando se preciso) o balde de dados de um projeto.
export function bucket(db, pid) {
  if (!pid) return { expected: [], captures: [], results: [] };
  if (!db.byProject[pid]) db.byProject[pid] = { expected: [], captures: [], results: [] };
  return db.byProject[pid];
}

export function projectExists(db, pid) {
  return !!pid && db.projects.some((p) => p.id === pid);
}
