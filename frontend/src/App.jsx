import { useCallback, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Captura from './pages/Captura.jsx';
import PreVistoria from './pages/PreVistoria.jsx';
import Auditoria from './pages/Auditoria.jsx';
import { api, pingOnline } from './lib/api.js';
import { syncPending, refreshResultsFromServer, wipeLocalProject } from './lib/sync.js';
import { getActiveProjectId, setActiveProjectId } from './lib/project.js';
import { db } from './db.js';

export default function App() {
  const [online, setOnline] = useState(false);
  const [mode, setMode] = useState(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(getActiveProjectId());
  const activeProject = projects.find((p) => p.id === activeId) || null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [projErr, setProjErr] = useState('');

  const reloadProjects = useCallback(async () => {
    try {
      const { projects } = await api.listProjects();
      setProjects(projects);
      setActiveId((cur) => {
        if (cur && !projects.some((p) => p.id === cur)) { setActiveProjectId(''); return ''; }
        return cur;
      });
      return projects;
    } catch { return []; }
  }, []);

  const pickProject = useCallback((id) => {
    setActiveProjectId(id);
    setActiveId(id);
  }, []);

  async function refreshPending() {
    const pid = getActiveProjectId();
    if (!pid) return setPending(0);
    const n = await db.captures.where('status').anyOf('pendente', 'erro')
      .filter((c) => c.projectId === pid).count();
    setPending(n);
  }

  async function checkStatus() {
    const on = await pingOnline();
    setOnline(on);
    if (on) { try { setMode((await api.health()).mode); } catch {} }
  }

  useEffect(() => {
    checkStatus();
    reloadProjects();
    const i = setInterval(() => { checkStatus(); refreshPending(); }, 8000);
    window.addEventListener('online', checkStatus);
    window.addEventListener('offline', checkStatus);
    return () => { clearInterval(i); window.removeEventListener('online', checkStatus); window.removeEventListener('offline', checkStatus); };
  }, [reloadProjects]);

  useEffect(() => { refreshPending(); }, [activeId]);

  async function createProject() {
    const nome = newName.trim();
    if (!nome) return;
    try {
      const { project } = await api.createProject(nome);
      setNewName(''); setCreating(false); setProjErr('');
      await reloadProjects();
      pickProject(project.id);
      setMenuOpen(false);
    } catch (e) { setProjErr(e.message); }
  }

  async function deleteActive() {
    if (!activeProject) return;
    const c = activeProject.counts || {};
    const okDel = window.confirm(
      `Excluir o projeto "${activeProject.nome}"?\n\n` +
      `Isso apaga da API: ${c.expected || 0} ativos da lista, ${c.captures || 0} capturas e ` +
      `${c.results || 0} resultados. Não dá pra desfazer.`
    );
    if (!okDel) return;
    try {
      await api.deleteProject(activeProject.id);
      await wipeLocalProject(activeProject.id);
      pickProject('');
      await reloadProjects();
      setMsg('✔ Projeto excluído');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('✖ ' + e.message); }
  }

  async function doSync() {
    if (!activeId) { setMsg('Escolha um projeto primeiro.'); setTimeout(() => setMsg(''), 3000); return; }
    setSyncing(true);
    setMsg('Sincronizando...');
    const r = await syncPending((p) => setMsg(`${p.phase} (${p.count})`));
    if (r.ok) {
      await refreshResultsFromServer();
      await reloadProjects();
      setMsg(r.processed ? `✔ ${r.processed} ativo(s) processado(s) pela IA` : '✔ Nada pendente');
    } else if (r.reason === 'no-project') {
      setMsg('Escolha um projeto primeiro.');
    } else {
      setMsg(r.reason === 'offline' ? '✖ Sem conexão — dados salvos localmente' : '✖ ' + r.reason);
    }
    await refreshPending();
    setSyncing(false);
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <div className="min-h-full max-w-2xl mx-auto pb-20">
      <header className="sticky top-0 z-30 bg-slate-900 text-white">
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="text-xl">🔎</span>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex-1 min-w-0 text-left"
          >
            <h1 className="font-bold leading-tight truncate flex items-center gap-1">
              {activeProject ? activeProject.nome : 'Escolher projeto'}
              <span className="text-xs opacity-70">▾</span>
            </h1>
            <p className="text-[11px] text-slate-300 leading-tight">
              {online ? `online · IA ${mode || '...'}` : 'offline · modo campo'}
              {activeProject ? '' : ' · nenhum projeto'}
            </p>
          </button>

          {activeProject && (
            <button
              onClick={deleteActive}
              title="Excluir projeto"
              className="rounded-xl px-2 py-1.5 text-sm border border-slate-700 text-red-300 active:scale-95"
            >
              🗑️
            </button>
          )}
          <button onClick={doSync} disabled={syncing} className="btn-primary !py-1.5 !px-3 text-sm">
            {syncing ? '⏳' : '🔄'} Sync{pending ? ` (${pending})` : ''}
          </button>
        </div>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full bg-white text-slate-800 shadow-xl border-t border-slate-200 max-h-[70vh] overflow-auto">
            <div className="max-w-2xl mx-auto p-2">
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Projetos</div>
              {projects.length === 0 && (
                <div className="px-2 py-2 text-sm text-slate-400">Nenhum projeto ainda.</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { pickProject(p.id); setMenuOpen(false); }}
                  className={`w-full text-left px-2 py-2 rounded-lg flex items-center gap-2 ${
                    p.id === activeId ? 'bg-brand/10 text-brand-dark font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex-1 truncate">{p.nome}</span>
                  {p.counts && (
                    <span className="text-[11px] text-slate-400">
                      {p.counts.expected} ativos · {p.counts.results} result.
                    </span>
                  )}
                  {p.id === activeId && <span className="text-brand">✓</span>}
                </button>
              ))}

              <div className="border-t border-slate-100 mt-2 pt-2">
                {creating ? (
                  <div className="flex gap-2 px-2">
                    <input
                      autoFocus
                      className="input flex-1"
                      placeholder="nome do projeto"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createProject();
                        if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                      }}
                    />
                    <button className="btn-primary !px-4" onClick={createProject} disabled={!newName.trim()}>
                      Criar
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 text-brand-dark font-semibold"
                    onClick={() => setCreating(true)}
                  >
                    ＋ Criar projeto
                  </button>
                )}
                {projErr && <p className="text-xs text-red-600 px-2 pt-1">{projErr}</p>}
              </div>
            </div>
          </div>
        )}
      </header>

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}

      {msg && <div className="bg-brand/10 text-brand-dark text-sm px-4 py-2">{msg}</div>}

      <main className="p-4 space-y-4">
        <Routes>
          <Route path="/" element={<Dashboard online={online} projectId={activeId} hasProjects={projects.length > 0} />} />
          <Route path="/captura" element={<Captura projectId={activeId} onSaved={refreshPending} />} />
          <Route path="/pre-vistoria" element={<PreVistoria online={online} projectId={activeId} />} />
          <Route path="/auditoria" element={<Auditoria online={online} projectId={activeId} />} />
        </Routes>
      </main>

      <Nav />
    </div>
  );
}
