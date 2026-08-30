import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { refreshExpectedFromServer, refreshResultsFromServer } from '../lib/sync.js';

export default function Dashboard({ online, projectId, hasProjects }) {
  const expected = useLiveQuery(
    () => (projectId ? db.expected.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );
  const results = useLiveQuery(
    () => (projectId ? db.results.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );
  const captures = useLiveQuery(
    () => (projectId ? db.captures.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );

  useEffect(() => {
    if (online && projectId) { refreshExpectedFromServer(); refreshResultsFromServer(); }
  }, [online, projectId]);

  if (!projectId) {
    return (
      <div className="card px-4 py-10 text-center text-sm text-slate-500 space-y-1">
        <div className="text-3xl">📁</div>
        <p className="font-semibold">Nenhum projeto selecionado</p>
        <p className="text-slate-400">
          Toque no nome <b>“Escolher projeto ▾”</b> no topo para {hasProjects ? 'escolher' : 'criar'} um.
        </p>
      </div>
    );
  }

  const byCode = Object.fromEntries(results.map((r) => [String(r.codigo).toLowerCase(), r]));
  const novos = results.filter((r) => r.status === 'novo');
  const rows = expected.map((e) => ({ ...e, result: byCode[String(e.codigo).toLowerCase()] || null }));

  const count = {
    confirmado: rows.filter((r) => r.result?.status === 'confirmado').length,
    divergente: rows.filter((r) => r.result?.status === 'divergente').length,
    pendente: rows.filter((r) => !r.result).length,
    novo: novos.length,
  };
  const done = count.confirmado + count.divergente;
  const pct = expected.length ? Math.round((done / expected.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Módulo 2 · Vistoria em Campo</h2>
          <p className="text-sm text-slate-500">{done}/{expected.length} vistoriados · {pct}%</p>
        </div>
        <Link to="/captura" className="btn-primary">📷 Capturar</Link>
      </div>

      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['🟢', count.confirmado, 'Confirm.'],
          ['🟡', count.divergente, 'Diverg.'],
          ['🔴', count.pendente, 'Pend.'],
          ['🟠', count.novo, 'Novos'],
        ].map(([i, n, l]) => (
          <div key={l} className="card py-3">
            <div className="text-xl">{i}</div>
            <div className="text-xl font-bold">{n}</div>
            <div className="text-[11px] text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      {captures.some((c) => ['pendente', 'erro'].includes(c.status)) && (
        <div className="card p-3 text-sm bg-amber-50 border-amber-200">
          ⏳ {captures.filter((c) => ['pendente', 'erro'].includes(c.status)).length} captura(s) na fila local —
          toque em <b>Sync</b> quando tiver internet.
        </div>
      )}

      <div className="card divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.codigo} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.codigo} — {r.descricao}</div>
              <div className="text-xs text-slate-500 truncate">{r.localizacao || '—'}</div>
              {r.result?.divergencias?.length > 0 && (
                <div className="text-[11px] text-yellow-700 truncate">⚠ {r.result.divergencias[0]}</div>
              )}
            </div>
            <StatusBadge status={r.result?.status || 'pendente'} />
          </div>
        ))}
        {novos.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-center gap-3 bg-orange-50/50">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.codigo} — {r.descricao}</div>
              <div className="text-xs text-slate-500 truncate">Fora da lista prévia</div>
            </div>
            <StatusBadge status="novo" />
          </div>
        ))}
        {!expected.length && !novos.length && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Importe a lista prévia em <Link className="text-brand font-semibold" to="/pre-vistoria">Lista</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
