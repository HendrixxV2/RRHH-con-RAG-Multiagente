import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const suggestions = [
  { icon: '◷', category: 'TIEMPO LIBRE', title: 'Vacaciones y permisos', question: '¿Cómo solicito mis vacaciones?' },
  { icon: '✳', category: 'BIENESTAR', title: 'Beneficios para ti', question: '¿Qué beneficios tengo disponibles?' },
  { icon: '▤', category: 'GUÍA INTERNA', title: 'Políticas y recursos', question: '¿Dónde encuentro las políticas de la empresa?' },
]

function App() {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiOnline, setApiOnline] = useState(null)
  const [actor, setActor] = useState(null)
  const [view, setView] = useState('chat')
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(response => setApiOnline(response.ok))
      .catch(() => setApiOnline(false))
    fetch(`${API_URL}/me`, { headers: { 'x-user-id': 'EMP-001', 'x-user-role': 'rrhh' } })
      .then(response => response.ok ? response.json() : null)
      .then(result => setActor(result?.actor || null))
      .catch(() => setActor(null))
  }, [])

  async function openDashboard() {
    setView('dashboard')
    setDashboardLoading(true)
    try {
      const response = await fetch(`${API_URL}/dashboard`, {
        headers: { 'x-user-id': 'EMP-001', 'x-user-role': 'rrhh' }
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el dashboard')
      setDashboard(result)
    } catch (error) {
      setDashboard({ error: error.message })
    } finally {
      setDashboardLoading(false)
    }
  }

  useEffect(() => {
    if (messages.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading])

  async function sendQuestion(event) {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || loading) return

    const history = messages.filter(message => !message.error)
    setMessages(current => [...current, { role: 'user', content: prompt }])
    setQuestion('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': actor?.id || 'EMP-001',
          'x-user-role': actor?.rol || 'rrhh'
        },
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

  function newConversation() {
    if (loading) return
    setMessages([])
    setQuestion('')
    inputRef.current?.focus()
  }

  function useSuggestion(text) {
    setQuestion(text)
    inputRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">✳</span>
          <div><strong>entre<span>nos</span></strong><small>ESPACIO DE PERSONAS</small></div>
        </div>
        <div className="sidebar-main">
          <p className="side-label">TU ESPACIO</p>
          <button className="nav-item active" onClick={newConversation} type="button" disabled={loading}>
            <span className="nav-icon">✳</span><span>Asistente</span><span className="nav-arrow">↗</span>
          </button>
          {actor?.rol === 'rrhh' && (
            <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={openDashboard} type="button">
              <span className="nav-icon">▦</span><span>Dashboard RRHH</span><span className="nav-arrow">↗</span>
            </button>
          )}
          <div className="sidebar-note">
            <span className="note-sparkle">✳</span>
            <p>Las respuestas que necesitas, <em>en un solo lugar.</em></p>
            <span className="note-line" />
            <small>HECHO PARA LAS PERSONAS</small>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className={`connection ${apiOnline === true ? 'online' : ''}`} role="status">
            <span className="status-dot" />
            <span>{apiOnline === null ? 'Comprobando conexión' : apiOnline ? 'Asistente disponible' : 'Sin conexión a la API'}</span>
          </div>
          <div className="side-footer"><span>UN ESPACIO PARA TI</span><span>✳</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Tu espacio</span><span className="crumb-divider">/</span><strong>Asistente</strong></div>
          <div className="topbar-right"><span className="topbar-label">TU DÍA, UN POCO MÁS SIMPLE</span><span className="avatar">✳</span></div>
        </header>

        <section className="workspace" aria-label="Asistente de Recursos Humanos">
          <div className="workspace-inner">
            {view === 'dashboard' ? (
              <div className="dashboard-view">
                <div className="conversation-heading">
                  <div><span className="section-number">RRHH / DASHBOARD</span><h1>Reporte ejecutivo <em>diario.</em></h1></div>
                  <button className="reset-button" onClick={() => setView('chat')} type="button">← Volver al chat</button>
                </div>
                {dashboardLoading && <p>Calculando indicadores...</p>}
                {dashboard?.error && <p className="error">{dashboard.error}</p>}
                {dashboard && !dashboard.error && (
                  <>
                    <div className="metrics-grid">
                      <article><span>Solicitudes &gt; 3 días</span><strong>{dashboard.latest?.indicador?.solicitudes_pendientes_mas_3_dias ?? 0}</strong></article>
                      <article><span>Pasivo vacaciones</span><strong>{dashboard.latest?.indicador?.pasivo_vacaciones_mas_20_dias ?? 0}</strong></article>
                      <article><span>Incapacidades 30 días</span><strong>{dashboard.latest?.indicador?.incapacidades_30_dias ?? 0}</strong></article>
                      <article><span>Consultas 30 días</span><strong>{dashboard.latest?.indicador?.consultas_30_dias ?? 0}</strong></article>
                    </div>
                    {dashboard.latest?.resumen && (
                      <article className="executive-summary"><span>RESUMEN EJECUTIVO</span><p>{dashboard.latest.resumen}</p></article>
                    )}
                    <div className="pending-table">
                      <h2>Solicitudes pendientes</h2>
                      {dashboard.solicitudes_pendientes?.length ? (
                        <table><thead><tr><th>ID</th><th>Tipo</th><th>Inicio</th><th>Colaborador</th></tr></thead><tbody>
                          {dashboard.solicitudes_pendientes.map(item => (
                            <tr key={item.id}><td>{item.id}</td><td>{item.tipo}</td><td>{item.fecha_inicio || '—'}</td><td>{item.colaborador_id}</td></tr>
                          ))}
                        </tbody></table>
                      ) : <p>No hay solicitudes pendientes.</p>}
                    </div>
                  </>
                )}
              </div>
            ) : (
            <>
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-eyebrow"><span className="eyebrow-dot" /> TU ASISTENTE DE PERSONAS <span className="eyebrow-line" /> <span>01 / 01</span></div>
                <div className="hero">
                  <div className="hero-copy">
                    <p className="hello">HOLA, QUÉ BUENO VERTE POR AQUÍ <span>✳</span></p>
                    <h1>Estamos aquí<br />para <em>ayudarte.</em></h1>
                    <p className="intro">Las pequeñas dudas también importan. Encuentra respuestas claras en nuestros documentos de Recursos Humanos.</p>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
                    <span className="art-star">✳</span><span className="art-dot dot-one" /><span className="art-dot dot-two" />
                    <span className="art-caption">PARA TI,<br />SIEMPRE.</span>
                  </div>
                </div>
                <div className="suggestions-heading">
                  <div><span className="section-number">01 / EMPECEMOS</span><h2>¿En qué podemos ayudarte?</h2></div>
                  <p>Algunas ideas para comenzar <span>↘</span></p>
                </div>
                <div className="suggestions">
                  {suggestions.map(item => (
                    <button className="suggestion-card" key={item.category} onClick={() => useSuggestion(item.question)} type="button">
                      <span className="card-top"><span className="card-icon">{item.icon}</span><span className="card-arrow">↗</span></span>
                      <span className="card-category">{item.category}</span>
                      <strong>{item.title}</strong>
                      <span className="card-question">{item.question}</span>
                    </button>
                  ))}
                </div>
        </div>
            ) : (
              <div className="conversation">
                <div className="conversation-heading">
                  <div><span className="section-number">TU ESPACIO / ASISTENTE</span><h1>Una buena conversación <em>empieza aquí.</em></h1></div>
                  <button className="reset-button" onClick={newConversation} disabled={loading} type="button">＋ Nueva conversación</button>
                </div>
                <div className="messages" aria-live="polite">
                  {messages.map((message, index) => (
                    <article className={`message ${message.role} ${message.error ? 'error' : ''}`} key={`${message.role}-${index}`}>
                      <span className="message-avatar">{message.role === 'user' ? 'T' : '✳'}</span>
                      <div className="message-content">
                        <span className="message-label">{message.role === 'user' ? 'TÚ' : 'ENTRENOS · ASISTENTE'}</span>
                        <p>{message.content}</p>
                        {message.sources?.length > 0 && (
                          <div className="sources">
                            <span>DOCUMENTOS CONSULTADOS</span>
                            {message.sources.map(source => (
                              <a href={source.link || `https://drive.google.com/open?id=${encodeURIComponent(source.fileId)}`} key={`${source.fileId}-${source.index}`} rel="noreferrer" target="_blank">
                                ↗ &nbsp;[{source.index}] {source.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                  {loading && <div className="typing" role="status"><span>✳</span> Buscando en los documentos...</div>}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}

            <div className="composer-area">
              <div className="composer-title"><span>HABLEMOS</span><span>✳</span></div>
              <form className="composer" onSubmit={sendQuestion}>
                <label className="sr-only" htmlFor="question">Escribe tu pregunta</label>
                <textarea
                  id="question"
                  ref={inputRef}
                  maxLength={4000}
                  onChange={event => setQuestion(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      event.currentTarget.form.requestSubmit()
                    }
                  }}
                  placeholder="Escribe aquí lo que tienes en mente..."
                  rows={2}
                  value={question}
                />
                <button disabled={loading || !question.trim()} type="submit" aria-label="Enviar pregunta">↗</button>
              </form>
              <div className="composer-footer"><span>↳ &nbsp; ENTER PARA ENVIAR · SHIFT + ENTER PARA SALTO DE LÍNEA</span><span>Respuestas basadas en documentos internos. Verifica la información importante.</span></div>
            </div>
            </>
            )}
          </div>
          <footer className="page-footer"><span>UN ESPACIO PARA LAS PERSONAS, HECHO CON CUIDADO.</span><span>ENTRENOS ©</span></footer>
        </section>
      </main>
    </div>
  )
}

export default App
