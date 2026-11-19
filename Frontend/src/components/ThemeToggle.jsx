import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('th-theme')
      if (saved !== null) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('th-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('th-theme', 'light')
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark((prev) => !prev)}
      aria-label="Cambiar tema claro/oscuro"
      className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 border border-white/60 dark:border-white/10 bg-white dark:bg-surface-dark shadow-card dark:shadow-card-dark"
    >
      {dark ? (
        <Moon className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
      ) : (
        <Sun className="w-5 h-5 text-orange-500 drop-shadow-[0_0_8px_rgba(255,152,0,0.3)]" />
      )}
    </button>
  )
}