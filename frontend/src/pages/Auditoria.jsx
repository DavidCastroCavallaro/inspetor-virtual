import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { api } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { refreshResultsFromServer } from '../lib/sync.js';
import { ESTADOS_CONSERVACAO, estadoLabel } from '../lib/conservacao.js';

export default function Auditoria({ online, projectId }) {
  const results = useLiveQuery(
    () => (projectId ? db.results.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => { if (online && projectId) refreshResultsFromServer(); }, [online, projectId]);

  async function act(id, payload) {
    if (!online) return setMsg('Conecte-se para auditar (usa o servidor).');
    setMsg('Salvando...');
    const { result } = await api.auditResult(id, payload);
    await db.results.put({ ...result, projectId });
    setMsg('✔ Atualizado');
    setTimeout(() => setMsg(''), 2500);
  }

  if (!projectId) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-400">
        Escolha ou crie um projeto no <b>Dashboard</b> primeiro.
      </div>
    );
  }

  const total = results.length;
  const avg = (k) => (total ? (results.reduce((a, r) => a + (r[k] || 0), 0) / total).toFixed(1) : '0');
  const q = busca.trim().toLowerCase();
  const resultsVisiveis = q
    ? results.filter((r) => [r.codigo, r.patrimonio, r.descricao, r.numeroSerie]
        .some((v) => String(v || '').toLowerCase().includes(q)))
    : results;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Módulo 4 · Pós-Vistoria</h2>
        <p className="text-sm text-slate-500">Auditoria final e exportação.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card py-3"><div className="text-xl font-bold">{total}</div><div className="text-[11px] text-slate-500">Ativos</div></div>
        <div className="card py-3"><div className="text-xl font-bold">{avg('vidaRemanescenteAnos')}a</div><div className="text-[11px] text-slate-500">Vida rem. média</div></div>
        <div className="card py-3"><div className="text-xl font-bold">{avg('depreciacaoPct')}%</div><div className="text-[11px] text-slate-500">Deprec. média</div></div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => api.exportXlsx()} className="btn-ghost flex-1">⬇️ Excel (.xlsx)</button>
        <button onClick={() => api.exportPdf()} className="btn-ghost flex-1">⬇️ Relatório PDF</button>
      </div>
      {msg && <p className="text-sm font-medium text-brand-dark">{msg}</p>}

      {results.length > 5 && (
        <input
          className="input"
          placeholder="Filtrar por código, patrimônio, descrição ou nº série..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      )}

      <div className="space-y-2">
        {resultsVisiveis.map((r) => (
          <div key={r.id} className="card overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center gap-3 text-left"
              onClick={() => setOpen(open === r.id ? null : r.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.codigo} — {r.fabricante} {r.modelo}</div>
                <div className="text-xs text-slate-500 truncate">
                  {r.patrimonio ? `Pat. ${r.patrimonio} · ` : ''}
                  {r.potencia} · {r.estadoConservacao ? r.estadoConservacao.toUpperCase() : r.condicao} · rem. {r.vidaRemanescenteAnos}a · dep. {r.depreciacaoPct}%
                </div>
              </div>
              <StatusBadge status={r.status} label={r.statusLabel} />
            </button>

            {open === r.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Patrimônio', r.patrimonio], ['Nº Série', r.numeroSerie], ['RPM', r.rpm], ['Voltagem', r.voltagem],
                    ['Ano', r.anoFabricacao], ['Vida útil total', r.vidaUtilTotalAnos + 'a'],
                    ['Idade', r.idadeAnos + 'a'], ['Confiança IA', r.confianca != null ? Math.round(r.confianca * 100) + '%' : '—'],
                    ['Motor IA', r.ai?.visionProvider],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-slate-50 rounded-lg px-2 py-1">
                      <span className="text-slate-400">{k}: </span><b>{v || '—'}</b>
                    </div>
                  ))}
                </div>

                {r.transcript && (
                  <p className="text-xs bg-blue-50 text-blue-800 rounded-lg px-2 py-1">🎙️ "{r.transcript}"</p>
                )}

                {r.divergencias?.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-2 space-y-2">
                    <div className="text-xs font-semibold text-yellow-800">Divergências:</div>
                    <ul className="text-xs text-yellow-800 list-disc pl-4">
                      {r.divergencias.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                    <div className="flex gap-2">
                      <button className="btn-primary flex-1 !py-1.5 text-xs" onClick={() => act(r.id, { decisao: 'aceitar_ia' })}>
                        Aceitar IA
                      </button>
                      <button className="btn-ghost flex-1 !py-1.5 text-xs" onClick={() => act(r.id, { decisao: 'manter_cadastro' })}>
                        Manter Cadastro
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 shrink-0">Condição (IA):</label>
                  <select
                    className="input !py-1 text-xs flex-1"
                    value={r.condicao}
                    onChange={(e) => act(r.id, { patch: { condicao: e.target.value } })}
                  >
                    {['Bom', 'Regular', 'Ruim'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 shrink-0">Estado observado:</label>
                  <select
                    className="input !py-1 text-xs flex-1"
                    value={r.estadoConservacao || ''}
                    onChange={(e) => act(r.id, { patch: { estadoConservacao: e.target.value || null } })}
                  >
                    <option value="">— usar Condição (IA) —</option>
                    {ESTADOS_CONSERVACAO.map((e) => (
                      <option key={e.codigo} value={e.codigo}>{e.codigo.toUpperCase()} — {e.label}</option>
                    ))}
                  </select>
                </div>
                {r.estadoConservacao && (
                  <p className="text-[11px] text-slate-400">{estadoLabel(r.estadoConservacao)}</p>
                )}

                <textarea
                  className="input text-xs" rows={2} defaultValue={r.observacao}
                  onBlur={(e) => e.target.value !== r.observacao && act(r.id, { patch: { observacao: e.target.value } })}
                />
              </div>
            )}
          </div>
        ))}
        {!results.length && (
          <div className="card px-4 py-8 text-center text-sm text-slate-400">
            Nenhum ativo processado. Faça capturas e toque em <b>Sync</b>.
          </div>
        )}
        {results.length > 0 && !resultsVisiveis.length && (
          <div className="card px-4 py-8 text-center text-sm text-slate-400">Nenhum ativo bate com esse filtro.</div>
        )}
      </div>
    </div>
  );
}
