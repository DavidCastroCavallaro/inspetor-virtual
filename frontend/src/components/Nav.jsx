import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Dashboard', icon: '📋' },
  { to: '/captura', label: 'Capturar', icon: '📷' },
  { to: '/pre-vistoria', label: 'Lista', icon: '📥' },
  { to: '/auditoria', label: 'Auditoria', icon: '✅' },
];

export default function Nav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 text-xs font-semibold ${
                isActive ? 'text-brand' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg leading-none">{it.icon}</span>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
