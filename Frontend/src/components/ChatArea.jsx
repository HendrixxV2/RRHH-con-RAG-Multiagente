import { useEffect, useRef, useState } from 'react'
import { Bell, Bot, Loader2, Send } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function renderSources(sources) {
  if (!sources?.length) return null

  return (
    <div className="mt-4 pt-3 border-t border-white/20 dark:border-white/10">
      <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest">
        Documentos consultados
      </span>
      {sources.map((source, index) => (
        <a
          key={source.fileId || source.link || index}
          href={source.link || `https://drive.google.com/open?id=${encodeURIComponent(source.fileId || '')}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline dark:text-primary flex items-center gap-1.5 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
          [{source.index || index + 1}] {source.fileName || source.document || 'Documento'}
        </a>
      ))}
    </div>
  )
}

export default function ChatArea() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola Ana! Tienes 3 tareas urgentes hoy. ¿Repasamos el resumen?',
      tasks: [
        { id: 1, title: 'Revisión de CVs (15)', status: 'Pendiente', statusColor: 'accent' },
        { id: 2, title: 'Entrevista con Laura S. (Marketing)', time: '14:00', status: null },
        { id: 3, title: 'Actualización de Políticas de Vacaciones', status: 'En Progreso', statusColor: 'primary' },
      ],
      sources: [],
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  async function handleSendMessage(event) {
    event.preventDefault()
    const question = inputValue.trim()
    if (!question || loading) return

    const history = messages
      .filter((message) => !message.error)
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }))

    setMessages((current) => [...current, { role: 'user', content: question, sources: [] }])
    setInputValue('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'EMP-001',
          'x-user-role': 'rrhh',
        },
        body: JSON.stringify({ question, history }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo completar la consulta')
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.answer || result.respuesta || 'Sin respuesta',
          sources: result.sources || result.citas || [],
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `No pude completar la consulta: ${error.message}`, sources: [], error: true },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen min-h-0 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-24" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/10 rounded-full blur-3xl -ml-24 -mb-24 dark:hidden" />

      <header className="relative z-10 flex items-center justify-between px-7 py-5 border-b border-white/60 dark:border-white/10 bg-white/80 dark:bg-panel-dark/95 backdrop-blur-md shadow-soft dark:shadow-soft-dark">
        <div className="flex items-center gap-7">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-glow" />
            <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-wider uppercase">Inter font</span>
          </div>
          <button type="button" aria-label="Notificaciones" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-3 pr-4 border-r border-white/60 dark:border-white/10">
            <img
              src="https://ui-avatars.com/api/?name=Ana+Garcia&background=00BFA5&color=fff&size=36&bold=true"
              alt="Ana García"
              className="w-9 h-9 rounded-xl object-cover border border-white/60 dark:border-white/10 shadow-soft"
            />
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">Ana García</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none uppercase tracking-wider">HR Manager</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background-light dark:bg-background-dark">
        <div className="relative z-10 bg-gradient-to-br from-primary to-secondary text-white px-7 py-4 shadow-glow flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Bot className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-semibold text-sm tracking-tight">HR Assistant Chat</span>
          </div>
          <button type="button" className="text-xs bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-2xl transition-colors border border-white/30 flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(255,152,0,0.5)]" /> + Tarea
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="flex flex-col gap-2 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              {message.role === 'assistant' && !message.error && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-2xl bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary border border-primary/10">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="rounded-3xl bg-white dark:bg-surface-dark p-5 text-gray-800 dark:text-slate-200 shadow-card dark:shadow-card-dark border border-white/60 dark:border-white/10">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      {message.tasks?.length > 0 && (
                        <div className="mt-5 space-y-3">
                          {message.tasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${task.statusColor === 'accent' ? 'bg-accent' : task.statusColor === 'primary' ? 'bg-primary' : 'bg-gray-400'}`} />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{task.title}</span>
                              </div>
                              {task.status && (
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${task.statusColor === 'accent' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                  {task.status}
                                </span>
                              )}
                              {task.time && <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 font-medium">{task.time}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {renderSources(message.sources)}
                    </div>
                  </div>
                </div>
              )}

              {message.role === 'user' && (
                <div className="flex gap-3 items-end justify-end">
                  <div className="rounded-3xl bg-primary text-white p-5 shadow-glow max-w-[85%]">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary border border-primary/10">
                    <span className="text-[10px] font-bold">A</span>
                  </div>
                </div>
              )}

              {message.error && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-2xl bg-red-50 dark:bg-red-900/20 flex-shrink-0 flex items-center justify-center text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800">
                    !
                  </div>
                  <div className="flex-1 rounded-3xl bg-red-50 dark:bg-red-900/20 p-5 text-red-700 dark:text-red-400 shadow-card dark:shadow-card-dark border border-red-100 dark:border-red-800">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-2xl bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex-1 rounded-3xl bg-white dark:bg-surface-dark p-5 text-gray-800 dark:text-slate-200 shadow-card dark:shadow-card-dark border border-white/60 dark:border-white/10">
                <p className="text-sm text-gray-500 dark:text-gray-400">Escribiendo…</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>

        <div className="relative z-20 bg-white/90 dark:bg-panel-dark/95 backdrop-blur-md border-t border-white/60 dark:border-white/10 p-6 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.03)] dark:shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.4)]">
          <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              maxLength={4000}
              placeholder="Pregúntale a Aura…"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="input-field flex-1 min-w-0"
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              aria-label="Enviar pregunta"
              className={`btn-primary flex items-center gap-2 ${loading || !inputValue.trim() ? 'opacity-50 cursor-not-allowed scale-95' : ''}`}
            >
              <Send className="w-4 h-4" />
              {loading && <span className="text-[10px]">Enviando</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
