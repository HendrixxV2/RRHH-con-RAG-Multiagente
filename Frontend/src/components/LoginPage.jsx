import { useState } from 'react'
import { Bot, Loader2, LockKeyhole, Mail } from 'lucide-react'

export default function LoginPage({ configured, loading, error, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onLogin({ email: email.trim(), password })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-light px-4 py-10 dark:bg-background-dark">
      <section className="card w-full max-w-md p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-glow">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Nexo Verde S.A.</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portal de Recursos Humanos</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Inicia sesión con la cuenta de colaborador registrada en el sistema.
        </p>

        {!configured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            Configura <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en el entorno del frontend.
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Correo electrónico
            <span className="relative mt-2 block">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="input-field w-full pl-11"
                placeholder="nombre@empresa.com"
                disabled={!configured || loading}
              />
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Contraseña
            <span className="relative mt-2 block">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="input-field w-full pl-11"
                placeholder="Tu contraseña"
                disabled={!configured || loading}
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={!configured || loading || !email.trim() || !password}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Iniciar sesión
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-gray-500 dark:text-gray-400">
          El rol y los permisos se verifican en el registro de colaboradores; no se aceptan roles enviados desde el navegador.
        </p>
      </section>
    </main>
  )
}
