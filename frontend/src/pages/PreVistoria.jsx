import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, expectedKey } from '../db.js';
import { api } from '../lib/api.js';
import { blobToBase64 } from '../lib/image.js';
import { refreshExpectedFromServer } from '../lib/sync.js';
import { titulo } from '../lib/format.js';

export default function PreVistoria({ online, projectId }) {
  const expected = useLiveQuery(
    () => (projectId ? db.expected.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  const inputRef = useRef();

  const q = busca.trim().toLowerCase();
  const visiveis = q
    ? expected.filter((e) => [e.codigo, e.patrimonio, e.descricao, e.localizacao]
        .some((v) => String(v || '').toLowerCase().includes(q)))
    : expected;

  useEffect(() => { if (online && projectId) refreshExpectedFromServer(); }, [online, projectId]);

  async function handleFile(file) {
    if (!file) return;
    if (!projectId) { setMsg('✖ Escolha um projeto no Dashboard antes de importar.'); return; }
    setMsg('Lendo planilha...');
    try {
      const base64 = await blobToBase64(file);
      if (online) {
        const { count, expected: rows } = await api.importExpected(base64);
        await db.expected.where('projectId').equals(projectId).delete();
        await db.expected.bulkPut(rows.map((r) => ({ ...r, projectId, key: expectedKey(projectId, r.codigo) })));
        setMsg(`✔ ${count} ativos importados`);
      } else {
        setMsg('✖ Importe a lista com internet (usa o servidor p/ ler .xlsx)');
      }
    } catch (e) {
      setMsg('✖ ' + e.message);
    }
    setTimeout(() => setMsg(''), 5000);
  }

  if (!projectId) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-400">
        Escolha ou crie um projeto no <b>Dashboard</b> primeiro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Módulo 1 · Pré-Vistoria</h2>
        <p className="text-sm text-slate-500">Importe a relação oficial de ativos esperados (.xlsx).</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`card p-8 text-center cursor-pointer border-2 border-dashed ${
          drag ? 'border-brand bg-brand/5' : 'border-slate-300'
        }`}
      >
        <div className="text-4xl">📥</div>
        <p className="font-semibold mt-2">Arraste o Excel aqui ou toque para selecionar</p>
        <p className="text-xs text-slate-400 mt-1">
          Colunas: Código (opcional), Patrimônio / Bem Patrimonial / Nº Inventário, Descrição, Fabricante, Modelo,
          Potência, RPM, Voltagem, Ano, Localização Esperada
        </p>
        <p className="text-[11px] text-slate-400">
          Sem Código na planilha? Ele usa o Patrimônio ou a Descrição para identificar o ativo.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {msg && <p className="text-sm font-medium text-brand-dark">{msg}</p>}

      {expected.length > 5 && (
        <input
          className="input"
          placeholder="Filtrar por código, patrimônio, descrição ou local..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      )}

      <div className="card divide-y divide-slate-100">
        <div className="px-4 py-2 text-sm font-bold text-slate-500">
          {visiveis.length} de {expected.length} ativos esperados
        </div>
        {visiveis.map((e) => (
          <div key={e.codigo} className="px-4 py-2 text-sm">
            <div className="font-semibold">{titulo(e.codigo, e.descricao)}</div>
            <div className="text-slate-500 text-xs">
              {[e.patrimonio && `Pat. ${e.patrimonio}`, e.fabricante, e.modelo, e.potencia, e.localizacao]
                .filter(Boolean).join(' · ')}
            </div>
          </div>
        ))}
        {!expected.length && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            Nenhuma lista importada. Use <code>backend/data/ativos_exemplo.xlsx</code>.
          </div>
        )}
        {expected.length > 0 && !visiveis.length && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhum ativo bate com esse filtro.</div>
        )}
      </div>
    </div>
  );
}
