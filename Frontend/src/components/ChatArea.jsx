import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send } from 'lucide-react'
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
          {source.section ? ` · ${source.section}` : ''}
          {source.version ? ` · v${source.version}` : ''}
        </a>
      ))}
    </div>
  )
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'U'
}

export default function ChatArea({ accessToken, actor }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hola${actor?.nombre ? ` ${actor.nombre}` : ''}. Puedo ayudarte con políticas internas y con tus datos de Recursos Humanos.`,
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
          Authorization: `Bearer ${accessToken}`,
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
          agent: result.agent?.name,
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
    <div className="relative flex h-[calc(100dvh-120px)] min-h-[480px] flex-1 flex-col overflow-hidden md:h-screen">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-24" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/10 rounded-full blur-3xl -ml-24 -mb-24 dark:hidden" />

      <header className="relative z-10 flex items-center justify-between px-7 py-5 border-b border-white/60 dark:border-white/10 bg-white/80 dark:bg-panel-dark/95 backdrop-blur-md shadow-soft dark:shadow-soft-dark">
        <div className="flex items-center gap-7">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-glow" />
            <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-wider uppercase">Asistente de RR. HH.</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-3 pr-4 border-r border-white/60 dark:border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
              {initials(actor?.nombre)}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{actor?.nombre}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none uppercase tracking-wider">
                {actor?.rol === 'rrhh' ? 'RR. HH.' : 'Colaborador'}
              </p>
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
            <span className="font-semibold text-sm tracking-tight">Chat de Recursos Humanos</span>
          </div>
          <span className="text-xs text-white/90">Consulta tus políticas y datos</span>
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
                      {message.agent && (
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-primary">
                          {message.agent}
                        </span>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
                    <span className="text-[10px] font-bold">{initials(actor?.nombre)}</span>
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
