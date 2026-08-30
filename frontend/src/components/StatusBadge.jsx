const MAP = {
  confirmado: { c: 'bg-green-100 text-green-700', d: '🟢 Confirmado' },
  divergente: { c: 'bg-yellow-100 text-yellow-800', d: '🟡 Divergente' },
  pendente: { c: 'bg-red-100 text-red-700', d: '🔴 Pendente' },
  novo: { c: 'bg-orange-100 text-orange-700', d: '🟠 Novo Ativo' },
  sincronizado: { c: 'bg-slate-100 text-slate-600', d: '✅ Sincronizado' },
  erro: { c: 'bg-red-100 text-red-700', d: '⚠️ Erro' },
};

export default function StatusBadge({ status, label }) {
  const m = MAP[status] || { c: 'bg-slate-100 text-slate-600', d: status };
  return <span className={`chip ${m.c}`}>{label || m.d}</span>;
}
