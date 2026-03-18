import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', labelJa: 'ダッシュボード', icon: 'D' },
  { to: '/skills', labelJa: 'スキル', icon: 'S' },
  { to: '/qa', labelJa: 'QAレポート', icon: 'Q' },
  { to: '/evals', labelJa: '評価', icon: 'E' },
  { to: '/browse', labelJa: 'ブラウズ', icon: 'B' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 border-b border-gstack-border bg-gstack-surface md:hidden">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          <span className="text-gstack-accent">g</span>stack
        </h1>
        <button
          className="p-2 text-gstack-muted hover:text-white transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="メニュー"
        >
          {sidebarOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-56 flex-shrink-0 border-r border-gstack-border bg-gstack-surface flex flex-col transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="p-4 border-b border-gstack-border">
          <h1 className="text-lg font-semibold text-white tracking-tight">
            <span className="text-gstack-accent">g</span>stack
          </h1>
          <p className="text-xs text-gstack-dim mt-0.5">ダッシュボード</p>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gstack-accent-bg text-gstack-accent border-r-2 border-gstack-accent'
                    : 'text-gstack-muted hover:text-gstack-text hover:bg-white/5'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="w-5 h-5 rounded bg-gstack-border flex items-center justify-center text-xs font-mono font-bold">
                {item.icon}
              </span>
              {item.labelJa}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gstack-border text-xs text-gstack-dim font-mono">
          v0.3.3
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
