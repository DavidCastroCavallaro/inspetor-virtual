import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { compressImage, base64ToUrl } from '../lib/image.js';
import { VoiceRecorder } from '../lib/audio.js';

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
  const [photo, setPhoto] = useState(null); // {base64,mime,bytes,width,height}
  const [audio, setAudio] = useState(null); // {base64,mime}
  const [obs, setObs] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState('');
  const camRef = useRef();
  const recRef = useRef(null);

  const selected = useMemo(
    () => expected.find((e) => e.codigo === hintCodigo) || null,
    [expected, hintCodigo]
  );

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

      <div className="card p-3 space-y-3">
        <label className="text-sm font-semibold">Ativo esperado (opcional)</label>
        <select className="input" value={hintCodigo} onChange={(e) => setHint(e.target.value)}>
          <option value="">— Não sei / Novo ativo —</option>
          {expected.map((e) => (
            <option key={e.codigo} value={e.codigo}>{e.codigo} — {e.descricao}</option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-slate-500">
            Cadastro: {[selected.fabricante, selected.modelo, selected.potencia, selected.localizacao].filter(Boolean).join(' · ')}
          </p>
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
          <button className="btn-primary w-full" onClick={() => camRef.current?.click()}>
            Abrir câmera / galeria
          </button>
        )}
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files[0])}
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
