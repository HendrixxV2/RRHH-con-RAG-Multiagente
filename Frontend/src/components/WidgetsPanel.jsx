import { Calendar, MoreHorizontal, User, Briefcase, ChevronRight, CheckCircle2 } from 'lucide-react'

const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function WidgetsPanel() {
  return (
    <aside className="hidden w-80 flex-shrink-0 border-l border-white/60 dark:border-white/10 bg-background-light dark:bg-background-dark lg:flex flex-col h-screen overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto p-6 space-y-7">
        <div className="card overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white tracking-tight">Próximas tareas</h3>
              </div>
              <button type="button" aria-label="Más opciones" className="p-2 rounded-xl text-gray-400 hover:text-primary dark:text-gray-500 dark:hover:text-primary transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-primary/5 dark:hover:bg-primary/10">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Agosto</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center mb-4">
              {days.map((day, index) => (
                <div key={`${day}-${index}`} className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-6">
              {[...Array(31)].map((_, index) => {
                const dayNum = index + 1
                const isHighlighted = dayNum === 8
                return (
                  <div key={dayNum} className={`aspect-square rounded-xl flex items-center justify-center text-[11px] transition-all ${isHighlighted ? 'bg-primary text-white font-bold shadow-glow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}>
                    {dayNum}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5 tracking-tight flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Candidatos tracking
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Avance de contratación</span>
                  <span className="text-primary font-bold">35%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-1000" style={{ width: '35%' }} />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-white/60 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Candidatos en proceso</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">35</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5 tracking-tight">Quick links</h3>
            <div className="space-y-3">
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-white/60 dark:border-white/10 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 group text-left">
                <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:text-primary transition-colors">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Nueva vacación</span>
                <ChevronRight className="ml-auto w-3 h-3 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-white/60 dark:border-white/10 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 group text-left">
                <img src="https://ui-avatars.com/api/?name=Payroll&background=00BFA5&color=fff&size=32&bold=true" alt="Nómina" className="w-8 h-8 rounded-xl object-cover border border-white/60 dark:border-white/10 group-hover:shadow-[0_0_12px_rgba(0,191,165,0.4)] transition-shadow" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Gestionar nómina</span>
                <ChevronRight className="ml-auto w-3 h-3 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}