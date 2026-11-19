import {
  LayoutDashboard,
  Briefcase,
  CreditCard,
  BarChart,
  Settings,
  ChevronRight,
  Activity,
} from 'lucide-react'

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, active: true },
  { name: 'Employees', icon: Activity, active: false },
  { name: 'Recruitment', icon: Briefcase, active: false },
  { name: 'Payroll', icon: CreditCard, active: false },
  { name: 'Performance', icon: BarChart, active: false },
  { name: 'Settings', icon: Settings, active: false },
]

export default function Sidebar() {
  return (
    <aside className="hidden w-72 flex-shrink-0 border-r border-white/60 dark:border-white/10 bg-white dark:bg-panel-dark md:flex flex-col h-screen z-20">
      {/* Gradient top accent */}
      <div className="h-1 bg-gradient-to-r from-primary via-secondary to-accent" />

      {/* Sidebar Header */}
      <div className="flex items-center gap-3 px-7 py-7 border-b border-white/60 dark:border-white/10">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
          <span className="text-white font-bold text-lg tracking-tight">T</span>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            TalentHub AI
          </h3>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wide uppercase">
            Ana García · HR Manager
          </p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-5 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.name}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                item.active
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary shadow-[0_0_20px_rgba(0,191,165,0.10)] dark:shadow-[0_0_30px_rgba(0,191,165,0.15)]'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.name}
              {item.active && (
                <ChevronRight className="ml-auto w-4 h-4 shrink-0 text-primary" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom separator & version */}
      <div className="border-t border-white/60 dark:border-white/10 mt-auto pt-6 pb-8 px-7">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          v2.4.0
        </div>
      </div>
    </aside>
  )
}