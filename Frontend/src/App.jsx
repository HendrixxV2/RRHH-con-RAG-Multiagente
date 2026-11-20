import { useEffect, useState } from 'react'
import ChatArea from './components/ChatArea'
import Dashboard from './components/Dashboard'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import { supabase, supabaseConfigured } from './lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabaseConfigured)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [actor, setActor] = useState(null)
  const [actorLoading, setActorLoading] = useState(false)
  const [actorError, setActorError] = useState('')
  const [activeView, setActiveView] = useState('chat')

  useEffect(() => {
    if (!supabaseConfigured) {
      return undefined
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setActor(null)
      setActorError('')
      setActiveView('chat')
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError(error.message)
      setSession(data.session)
      setAuthReady(true)
    }).catch(error => {
      if (!active) return
      setAuthError(error.message)
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.access_token) {
      return undefined
    }

    const controller = new AbortController()
    async function loadActor() {
      setActorLoading(true)
      setActorError('')
      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo validar la cuenta')
        if (!['colaborador', 'rrhh'].includes(result.actor?.rol)) {
          throw new Error('El perfil no tiene un rol válido')
        }
        setActor(result.actor)
      } catch (error) {
        if (error.name !== 'AbortError') setActorError(error.message)
      } finally {
        if (!controller.signal.aborted) setActorLoading(false)
      }
    }

    loadActor()
    return () => controller.abort()
  }, [session?.access_token])

  async function handleLogin({ email, password }) {
    if (!supabase) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      setAuthError(error.message || 'No se pudo iniciar sesión')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setActorError(`No se pudo cerrar la sesión: ${error.message}`)
  }

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando sesión…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <LoginPage
        configured={supabaseConfigured}
        loading={authLoading}
        error={authError}
        onLogin={handleLogin}
      />
    )
  }

  if (actorLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <p className="text-sm text-gray-500 dark:text-gray-400">Verificando acceso…</p>
      </main>
    )
  }

  if (actorError || !actor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-light px-4 dark:bg-background-dark">
        <section className="card w-full max-w-lg p-7">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">No se pudo validar tu perfil</h1>
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {actorError || 'La cuenta no está vinculada a un colaborador.'}
          </p>
          <button type="button" className="btn-primary mt-6" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  const showDashboard = activeView === 'dashboard' && actor.rol === 'rrhh'

  return (
    <div className="flex min-h-screen flex-col bg-background-light dark:bg-background-dark md:flex-row">
      <Sidebar
        actor={actor}
        activeView={showDashboard ? 'dashboard' : 'chat'}
        onNavigate={setActiveView}
        onSignOut={handleSignOut}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showDashboard
          ? <Dashboard accessToken={session.access_token} />
          : <ChatArea accessToken={session.access_token} actor={actor} />}
      </main>
    </div>
  )
}
