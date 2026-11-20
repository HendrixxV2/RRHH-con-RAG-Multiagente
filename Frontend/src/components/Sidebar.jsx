import { LayoutDashboard, LogOut, MessageSquareText } from 'lucide-react'

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'U'
}

export default function Sidebar({ actor, activeView, onNavigate, onSignOut }) {
  const menuItems = [
    { id: 'chat', name: 'Asistente', icon: MessageSquareText },
    ...(actor?.rol === 'rrhh'
      ? [{ id: 'dashboard', name: 'Dashboard RR. HH.', icon: LayoutDashboard }]
      : []),
  ]

  return (
    <aside className="z-20 w-full shrink-0 border-b border-white/60 bg-white dark:border-white/10 dark:bg-panel-dark md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6 md:py-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white shadow-glow">
          N
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold tracking-tight text-gray-900 dark:text-white">Nexo Verde</h1>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {actor?.nombre} · {actor?.rol === 'rrhh' ? 'RR. HH.' : 'Colaborador'}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Navegación principal" className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto md:px-4 md:py-6">
        {menuItems.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={activeView === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
              activeView === id
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {name}
          </button>
        ))}
      </nav>

      <div className="hidden border-t border-border-light p-5 dark:border-border-dark md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {initials(actor?.nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{actor?.nombre}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{actor?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
