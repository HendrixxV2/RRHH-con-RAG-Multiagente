import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hola. Puedo responder preguntas basándome en los documentos de Recursos Humanos indexados.'
    }
  ])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(response => setApiOnline(response.ok))
      .catch(() => setApiOnline(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendQuestion(event) {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || loading) return

    const history = messages.filter(message => message.role === 'user' || message.role === 'assistant')
    setMessages(current => [...current, { role: 'user', content: prompt }])
    setQuestion('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, history })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la consulta')

      setMessages(current => [
        ...current,
        { role: 'assistant', content: result.answer, sources: result.sources || [] }
      ])
      setApiOnline(true)
    } catch (error) {
      setMessages(current => [
        ...current,
        { role: 'assistant', content: `No pude completar la consulta: ${error.message}`, error: true }
      ])
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">RH</div>
        <div>
          <p className="eyebrow">Asistente documental</p>
          <h1>Recursos Humanos</h1>
        </div>
        <div className={`connection ${apiOnline ? 'online' : ''}`} role="status">
          <span />
          {apiOnline ? 'API conectada' : 'API sin conexión'}
        </div>
      </header>

      <section className="chat-panel" aria-label="Conversación">
        <div className="messages" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`message ${message.role} ${message.error ? 'error' : ''}`}
              key={`${message.role}-${index}`}
            >
              <span className="message-label">{message.role === 'user' ? 'Tú' : 'Asistente RRHH'}</span>
              <p>{message.content}</p>
              {message.sources?.length > 0 && (
                <div className="sources">
                  <span>Fuentes</span>
                  {message.sources.map(source => (
                    <a
                      href={`https://drive.google.com/open?id=${encodeURIComponent(source.fileId)}`}
                      key={`${source.fileId}-${source.index}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      [{source.index}] {source.fileName}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
          {loading && <p className="typing" role="status">Buscando en los documentos...</p>}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={sendQuestion}>
          <label className="sr-only" htmlFor="question">Escribe tu pregunta</label>
          <textarea
            id="question"
            maxLength={4000}
            onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }}
            placeholder="Pregunta sobre políticas, vacaciones, beneficios..."
            rows={2}
            value={question}
          />
          <button disabled={loading || !question.trim()} type="submit">
            {loading ? 'Consultando…' : 'Enviar'}
          </button>
        </form>
        <p className="disclaimer">Las respuestas se basan en documentos indexados y pueden requerir verificación.</p>
      </section>
    </main>
  )
}

export default App
