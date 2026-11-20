import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const KPI_FIELDS = [
  {
    key: 'consultas_30_dias',
    label: 'Consultas en 30 días',
    description: 'Consultas recibidas'
  },
  {
    key: 'solicitudes_pendientes_mas_3_dias',
    label: 'Solicitudes > 3 días',
    description: 'Pendientes por más de 3 días'
  },
  {
    key: 'incapacidades_30_dias',
    label: 'Incapacidades en 30 días',
    description: 'Registradas en el período'
  },
  {
    key: 'pasivo_vacaciones_mas_20_dias',
    label: 'Pasivo de vacaciones',
    description: 'Personas con más de 20 días'
  }
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date)
}

function formatValue(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('es').format(value)
    : '—'
}

function EmptyState({ children }) {
  return (
    <p className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {children}
    </p>
  )
}

function TrendChart({ history }) {
  const points = useMemo(() => history
    .filter((report) => Number.isFinite(report?.indicador?.consultas_30_dias))
    .slice()
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))), [history])

  if (!points.length) {
    return <EmptyState>No hay datos históricos de consultas para graficar.</EmptyState>
  }

  const width = 640
  const height = 220
  const padding = { top: 16, right: 18, bottom: 34, left: 44 }
  const values = points.map((point) => point.indicador.consultas_30_dias)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - ((point.indicador.consultas_30_dias - min) / range) * chartHeight
  }))
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Tendencia de consultas en 30 días para ${points.length} reportes históricos`}
        className="min-w-[420px] w-full"
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + chartHeight * fraction
          const value = Math.round(max - (max - min) * fraction)
          return (
            <g key={fraction}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="stroke-gray-200 dark:stroke-gray-700" strokeDasharray="4 5" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-500 dark:fill-gray-400" fontSize="11">{value}</text>
            </g>
          )
        })}
        <polyline points={line} fill="none" className="stroke-primary" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {coordinates.map((point) => (
          <circle key={point.fecha} cx={point.x} cy={point.y} r="4" className="fill-primary">
            <title>{`${formatDate(point.fecha)}: ${formatValue(point.indicador.consultas_30_dias)} consultas`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text
            key={points[index].fecha}
            x={coordinates[index].x}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            className="fill-gray-500 dark:fill-gray-400"
            fontSize="11"
          >
            {formatDate(points[index].fecha)}
          </text>
        ))}
      </svg>
    </div>
  )
}

function TopicsChart({ topics }) {
  const rows = Array.isArray(topics)
    ? topics.filter((item) => item && typeof item.tema === 'string' && Number.isFinite(item.cantidad) && item.cantidad >= 0)
    : []
  const max = Math.max(...rows.map((item) => item.cantidad), 0)

  if (!rows.length) {
    return <EmptyState>No hay temas con brechas RAG registrados en el último reporte.</EmptyState>
  }

  return (
    <div role="img" aria-label="Gráfico de barras horizontales de los principales temas con brechas RAG" className="space-y-4">
      {rows.map((item, index) => (
        <div key={`${item.tema}-${index}`} className="grid grid-cols-[minmax(90px,1fr)_3fr_auto] items-center gap-3">
          <span className="truncate text-sm text-gray-700 dark:text-gray-300" title={item.tema}>{item.tema}</span>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${max ? (item.cantidad / max) * 100 : 0}%` }} />
          </div>
          <span className="min-w-8 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{formatValue(item.cantidad)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ accessToken }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Error al consultar el servidor (${response.status}).`)
    }
    return data
  }, [accessToken])

  const loadDashboard = useCallback(async (signal) => {
    const data = await request('/dashboard', { signal })
    setDashboard(data)
  }, [request])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve()
      .then(() => loadDashboard(controller.signal))
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'No se pudo cargar el panel.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadDashboard])

  const runAnalyst = async () => {
    setRunning(true)
    setError('')
    try {
      await request('/analyst/run', { method: 'POST' })
      await loadDashboard()
    } catch (runError) {
      setError(runError.message || 'No se pudo generar el reporte.')
    } finally {
      setRunning(false)
    }
  }

  const latest = dashboard?.latest
  const indicador = latest?.indicador || {}
  const history = Array.isArray(dashboard?.history) ? dashboard.history : []
  const pending = Array.isArray(dashboard?.solicitudes_pendientes) ? dashboard.solicitudes_pendientes : []
  const priorReports = history.filter((report) => report?.fecha !== latest?.fecha)

  return (
    <main className="min-h-full w-full space-y-6 p-4 sm:p-6 lg:p-8" aria-labelledby="dashboard-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Recursos Humanos</p>
          <h1 id="dashboard-title" className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Panel de análisis</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {latest ? `Reporte más reciente: ${formatDate(latest.fecha)}` : 'Indicadores agregados y solicitudes pendientes'}
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalyst}
          disabled={loading || running}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Ejecutar analista y actualizar el panel"
        >
          {running ? 'Generando reporte…' : 'Ejecutar analista'}
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <span>{error}</span>
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => {
            setLoading(true)
            setError('')
            loadDashboard().catch((loadError) => setError(loadError.message || 'No se pudo cargar el panel.')).finally(() => setLoading(false))
          }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite" className="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">Cargando indicadores…</div>
      ) : (
        <>
          {!latest && (
            <div className="card p-5">
              <EmptyState>Aún no hay reportes disponibles. Ejecuta el analista para generar el primer reporte.</EmptyState>
            </div>
          )}

          <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_FIELDS.map((metric) => (
              <article key={metric.key} className="card p-5">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {latest ? formatValue(indicador[metric.key]) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{metric.description}</p>
              </article>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <article className="card p-5 sm:p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Tendencia de consultas</h2>
              <p className="mb-4 mt-1 text-sm text-gray-500 dark:text-gray-400">Consultas en 30 días por reporte histórico</p>
              <TrendChart history={history} />
            </article>
            <article className="card p-5 sm:p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Temas con brechas RAG</h2>
              <p className="mb-5 mt-1 text-sm text-gray-500 dark:text-gray-400">Principales temas del reporte más reciente</p>
              {latest
                ? <TopicsChart topics={indicador.top5_temas_brechas_rag} />
                : <EmptyState>No hay un reporte reciente para mostrar temas.</EmptyState>}
            </article>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-base font-bold text-gray-900 dark:text-white">Resumen ejecutivo</h2>
            {latest?.resumen
              ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-gray-300">{latest.resumen}</p>
              : <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No hay resumen ejecutivo disponible.</p>}
          </section>

          <section className="card overflow-hidden" aria-labelledby="pending-title">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800 sm:px-6">
              <h2 id="pending-title" className="text-base font-bold text-gray-900 dark:text-white">Solicitudes pendientes</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Solicitudes pendientes recibidas por RR. HH.</p>
            </div>
            {pending.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Listado de solicitudes pendientes</caption>
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th scope="col" className="px-5 py-3 sm:px-6">Colaborador</th>
                      <th scope="col" className="px-5 py-3 sm:px-6">Tipo</th>
                      <th scope="col" className="px-5 py-3">Fecha de solicitud</th>
                      <th scope="col" className="px-5 py-3">Inicio</th>
                      <th scope="col" className="px-5 py-3">Fin</th>
                      <th scope="col" className="px-5 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pending.map((requestRow) => (
                      <tr key={requestRow.id} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-medium sm:px-6">
                          {requestRow.colaborador?.nombre || requestRow.colaborador?.email || '—'}
                        </td>
                        <td className="px-5 py-3 font-medium sm:px-6">{requestRow.tipo || '—'}</td>
                        <td className="px-5 py-3">{formatDate(requestRow.fecha_solicitud)}</td>
                        <td className="px-5 py-3">{formatDate(requestRow.fecha_inicio)}</td>
                        <td className="px-5 py-3">{formatDate(requestRow.fecha_fin)}</td>
                        <td className="px-5 py-3">{requestRow.estado || 'Pendiente'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5"><EmptyState>No hay solicitudes pendientes.</EmptyState></div>
            )}
          </section>

          <section className="card overflow-hidden" aria-labelledby="history-title">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800 sm:px-6">
              <h2 id="history-title" className="text-base font-bold text-gray-900 dark:text-white">Reportes anteriores</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Historial de reportes guardados</p>
            </div>
            {priorReports.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Historial de reportes previos</caption>
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th scope="col" className="px-5 py-3 sm:px-6">Fecha</th>
                      <th scope="col" className="px-5 py-3">Consultas en 30 días</th>
                      <th scope="col" className="px-5 py-3">Solicitudes &gt; 3 días</th>
                      <th scope="col" className="px-5 py-3">Incapacidades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {priorReports.map((report) => (
                      <tr key={report.fecha} className="text-gray-700 dark:text-gray-300">
                        <td className="px-5 py-3 font-medium sm:px-6">{formatDate(report.fecha)}</td>
                        <td className="px-5 py-3">{formatValue(report.indicador?.consultas_30_dias)}</td>
                        <td className="px-5 py-3">{formatValue(report.indicador?.solicitudes_pendientes_mas_3_dias)}</td>
                        <td className="px-5 py-3">{formatValue(report.indicador?.incapacidades_30_dias)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5"><EmptyState>No hay reportes anteriores disponibles.</EmptyState></div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
