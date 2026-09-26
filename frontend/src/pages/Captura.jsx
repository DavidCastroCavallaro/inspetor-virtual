import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { compressImage, base64ToUrl } from '../lib/image.js';
import { VoiceRecorder } from '../lib/audio.js';
import { titulo } from '../lib/format.js';
import { STANDALONE } from '../lib/api.js';

export default function Captura({ onSaved, projectId }) {
  const expected = useLiveQuery(
    () => (projectId ? db.expected.where('projectId').equals(projectId).toArray() : []),
    [projectId], []
  );
  const queue = useLiveQuery(
    () => (projectId
      ? db.captures.where('projectId').equals(projectId).sortBy('capturedAt')
          .then((a) => a.reverse().slice(0, 8))
      : []),
    [projectId], []
  );

  const [hintCodigo, setHint] = useState('');
  const [busca, setBusca] = useState('');
  const [photo, setPhoto] = useState(null); // {base64,mime,bytes,width,height}
  const [audio, setAudio] = useState(null); // {base64,mime}
  const [obs, setObs] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState('');
  const camRef = useRef();
  const galRef = useRef();
  const recRef = useRef(null);

  const selected = useMemo(
    () => expected.find((e) => e.codigo === hintCodigo) || null,
    [expected, hintCodigo]
  );

  // busca/filtra por codigo, patrimonio ou descricao
  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? expected.filter((e) => [e.codigo, e.patrimonio, e.descricao]
          .some((v) => String(v || '').toLowerCase().includes(q)))
      : expected;
    return base.slice(0, 20);
  }, [expected, busca]);

  async function onPhoto(file) {
    if (!file) return;
    setBusy('Comprimindo imagem...');
    const c = await compressImage(file);
    setPhoto(c);
    setBusy('');
  }

  async function toggleRec() {
    if (!recording) {
      recRef.current = new VoiceRecorder();
      if (!recRef.current.supported) return alert('Gravação de áudio não suportada neste navegador.');
      await recRef.current.start();
      setRecording(true);
    } else {
      const a = await recRef.current.stop();
      setAudio(a);
      setRecording(false);
    }
  }

  async function save() {
    if (!projectId) return alert('Escolha um projeto no Dashboard antes de capturar.');
    if (!photo) return alert('Tire a foto da placa/equipamento.');
    setBusy('Salvando na fila local...');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db.captures.put({
      id,
      projectId,
      hintCodigo: hintCodigo || null,
      imageBase64: photo.base64,
      imageMime: photo.mime,
      imageMeta: { w: photo.width, h: photo.height, bytes: photo.bytes },
      audioBase64: audio?.base64 || null,
      audioMime: audio?.mime || null,
      observacao: obs,
      localizacao: selected?.localizacao || '',
      status: 'pendente',
      capturedAt: new Date().toISOString(),
    });
    setPhoto(null); setAudio(null); setObs(''); setHint(''); setBusy('');
    onSaved?.();
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
      <h2 className="text-lg font-bold">Captura Rápida</h2>

      <div className="card p-3 space-y-2">
        <label className="text-sm font-semibold">Ativo esperado (opcional)</label>

        {selected ? (
          <div className="flex items-start justify-between gap-2 bg-brand/5 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{titulo(selected.codigo, selected.descricao)}</div>
              {selected.patrimonio && (
                <div className="text-xs text-slate-500">Patrimônio: {selected.patrimonio}</div>
              )}
              <p className="text-xs text-slate-500">
                {[selected.fabricante, selected.modelo, selected.potencia, selected.localizacao].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button className="text-xs text-red-600 font-semibold shrink-0" onClick={() => { setHint(''); setBusca(''); }}>
              trocar
            </button>
          </div>
        ) : (
          <>
            <input
              className="input"
              placeholder="Buscar por código, patrimônio ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="max-h-52 overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {resultadosBusca.map((e) => (
                <button
                  key={e.codigo}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50"
                  onClick={() => { setHint(e.codigo); setBusca(''); }}
                >
                  <div className="text-sm font-medium truncate">{titulo(e.codigo, e.descricao)}</div>
                  {e.patrimonio && (
                    <div className="text-[11px] text-slate-400">Patrimônio: {e.patrimonio}</div>
                  )}
                </button>
              ))}
              {!resultadosBusca.length && (
                <div className="px-3 py-3 text-xs text-slate-400 text-center">Nenhum ativo encontrado</div>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Deixe em branco para registrar como Novo Ativo.</p>
          </>
        )}
      </div>

      <div className="card p-3 space-y-3">
        <label className="text-sm font-semibold">📷 Foto da placa</label>
        {photo ? (
          <div className="space-y-2">
            <img src={base64ToUrl(photo.base64)} className="rounded-xl w-full" alt="captura" />
            <p className="text-[11px] text-slate-500">
              {photo.width}×{photo.height}px · {(photo.bytes / 1024).toFixed(0)} KB (comprimida no cliente)
            </p>
            <button className="btn-ghost w-full" onClick={() => setPhoto(null)}>Refazer</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => camRef.current?.click()}>
              📷 Tirar foto
            </button>
            <button className="btn-ghost flex-1" onClick={() => galRef.current?.click()}>
              🖼️ Galeria
            </button>
          </div>
        )}
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ''; }}
        />
        <input
          ref={galRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ''; }}
        />
      </div>

      <div className="card p-3 space-y-3">
        <label className="text-sm font-semibold">🎙️ Observação por voz</label>
        <button
          className={recording ? 'btn w-full bg-red-600 text-white' : 'btn-ghost w-full'}
          onClick={toggleRec}
        >
          {recording ? '⏹️ Parar gravação' : audio ? '🔁 Regravar' : '⏺️ Gravar'}
        </button>
        {audio && <audio controls src={base64ToUrl(audio.base64, audio.mime)} className="w-full" />}
        <textarea
          className="input" rows={2} placeholder="ou digite a observação..."
          value={obs} onChange={(e) => setObs(e.target.value)}
        />
        {STANDALONE && (
          <p className="text-[11px] text-amber-600">
            ⚠️ Modo sem servidor: o áudio grava só p/ conferência, mas não é transcrito automaticamente — digite a observação pra IA usar.
          </p>
        )}
      </div>

      <button className="btn-primary w-full text-base py-3" onClick={save} disabled={!!busy}>
        {busy || '💾 Salvar na fila (offline)'}
      </button>

      <div className="card divide-y divide-slate-100">
        <div className="px-4 py-2 text-sm font-bold text-slate-500">Fila local recente</div>
        {(queue || []).map((c) => (
          <div key={c.id} className="px-4 py-2 flex items-center gap-3 text-sm">
            <img src={base64ToUrl(c.imageBase64)} className="w-10 h-10 rounded object-cover" alt="" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{c.hintCodigo || 'Novo ativo'}</div>
              <div className="text-[11px] text-slate-400">{new Date(c.capturedAt).toLocaleTimeString('pt-BR')}</div>
            </div>
            <span className="text-xs">{c.status === 'sincronizado' ? '✅' : c.status === 'erro' ? '⚠️' : '⏳'}</span>
          </div>
        ))}
        {!queue?.length && <div className="px-4 py-4 text-center text-xs text-slate-400">Vazio</div>}
      </div>
    </div>
  );
}
