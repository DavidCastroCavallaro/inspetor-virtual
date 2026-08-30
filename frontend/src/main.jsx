import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('App error:', err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', color: '#0f172a' }}>
        <h2 style={{ fontWeight: 700 }}>Algo quebrou ao carregar</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
          {String(this.state.err?.message || this.state.err)}
        </pre>
        <button
          onClick={() => location.reload()}
          style={{ padding: '10px 16px', borderRadius: 12, background: '#2563eb', color: '#fff', fontWeight: 600, border: 0 }}
        >
          Recarregar
        </button>
        <button
          onClick={async () => {
            try {
              const Dexie = (await import('dexie')).default;
              await Dexie.delete('inspetor_virtual_mp');
              await Dexie.delete('inspetor_virtual');
            } catch {}
            location.reload();
          }}
          style={{ marginLeft: 8, padding: '10px 16px', borderRadius: 12, background: '#e2e8f0', color: '#0f172a', fontWeight: 600, border: 0 }}
        >
          Limpar dados locais e recarregar
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
