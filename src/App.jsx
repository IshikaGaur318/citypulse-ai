
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import './App.css'

const API_URL = 'http://localhost:5001'


const initialMetrics = [
  { name: 'Traffic flow', value: 72, unit: '%', icon: '🚦', color: '#6ee7b7' },
  { name: 'Air quality', value: 64, unit: ' AQI', icon: '🌿', color: '#fbbf24' },
  { name: 'Energy usage', value: 58, unit: '%', icon: '⚡', color: '#a78bfa' },
  { name: 'Water reserves', value: 81, unit: '%', icon: '💧', color: '#60a5fa' },
]

const districts = [
  { name: 'North District', short: 'NORTH', left: '24%', top: '25%', color: '#6ee7b7' },
  { name: 'East District', short: 'EAST', left: '72%', top: '25%', color: '#fbbf24' },
  { name: 'Central District', short: 'CENTRAL', left: '45%', top: '55%', color: '#6ee7b7' },
  { name: 'South District', short: 'SOUTH', left: '76%', top: '72%', color: '#60a5fa' },
]

function formatHistoryRecord(record, index) {
  const values = Array.isArray(record.metrics) ? record.metrics : []

  const getValue = name =>
    Number(values.find(metric => metric.name === name)?.value ?? 0)

  return {
    update: index + 1,
    time: record.createdAt
      ? new Date(record.createdAt).toLocaleTimeString()
      : '—',
    traffic: getValue('Traffic flow'),
    aqi: getValue('Air quality'),
    energy: getValue('Energy usage'),
    water: getValue('Water reserves'),
  }
}

function App() { 
  const [predictions, setPredictions] = useState([]);
  const [predictionError, setPredictionError] = useState("");
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [metrics, setMetrics] = useState(() =>
    initialMetrics.map(item => ({ ...item }))
  )
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState([])
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [activePage, setActivePage] = useState('Overview')
  const [backendStatus, setBackendStatus] = useState('Checking...')
  const [backendMessage, setBackendMessage] = useState('')
  const [lastBackendUpdate, setLastBackendUpdate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const inFlightRef = useRef(false)

const predictionInFlightRef = useRef(false)

const loadPredictions = useCallback(async () => {
  if (predictionInFlightRef.current) return

  predictionInFlightRef.current = true
  setPredictionsLoading(true)
  setPredictionError('')

  try {
    const response = await fetch(
      'http://localhost:5001/api/ai/predictions'
    )

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.predictions)) {
      throw new Error('Invalid AI predictions response')
    }

    setPredictions(data.predictions)
  } catch (error) {
    setPredictionError(error.message || 'Could not load AI predictions')
  } finally {
    predictionInFlightRef.current = false
    setPredictionsLoading(false)
  }
}, [])
  const normalizeMetrics = useCallback(serverMetrics => {
    return initialMetrics.map(item => {
      const serverMetric = serverMetrics.find(
        metric => metric.name === item.name
      )

      return serverMetric
        ? { ...item, value: Number(serverMetric.value) }
        : { ...item }
    })
  }, [])

  const loadHistory = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/history`)

    if (!response.ok) {
      throw new Error(`History request failed (${response.status}).`)
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.history)) {
      throw new Error('Invalid history response from backend.')
    }

    // Backend returns newest first; reverse for chronological chart order.
    setHistory(
      data.history
        .slice()
        .reverse()
        .map((record, index) => formatHistoryRecord(record, index))
    )
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const [healthResponse, metricsResponse] = await Promise.all([
        fetch(`${API_URL}/api/health`),
        fetch(`${API_URL}/api/metrics`),
      ])

      if (!healthResponse.ok) {
        throw new Error(`Health request failed (${healthResponse.status}).`)
      }

      if (!metricsResponse.ok) {
        throw new Error(`Metrics request failed (${metricsResponse.status}).`)
      }

      const health = await healthResponse.json()
      const metricsData = await metricsResponse.json()

      if (!metricsData.success || !Array.isArray(metricsData.metrics)) {
        throw new Error('Invalid metrics response from backend.')
      }

      await loadHistory()

      setMetrics(normalizeMetrics(metricsData.metrics))
      setBackendStatus(health.status === 'OK' ? 'Connected' : 'Unavailable')
      setBackendMessage(
        health.database || health.project || 'Backend responded'
      )
      setLastBackendUpdate(metricsData.updatedAt || null)
      setErrorMessage('')
    } catch (error) {
      setBackendStatus('Offline')
      setBackendMessage('Could not load backend data')
      setErrorMessage(
        `Cannot load dashboard data. Ensure the backend is running on port 5001. ${error.message}`
      )
    }
  }, [loadHistory, normalizeMetrics])

  

useEffect(() => {
  loadDashboard()
  loadPredictions()
}, [loadDashboard, loadPredictions])


    
  const simulate = useCallback(async () => {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setBusy(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_URL}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Simulation request failed (${response.status}).`)
      }

      const data = await response.json()

      if (!data.success || !Array.isArray(data.metrics)) {
        throw new Error(data.message || 'Invalid simulation response.')
      }

      setMetrics(normalizeMetrics(data.metrics))
      setLastBackendUpdate(data.updatedAt || null)
      setBackendStatus('Connected')
      setBackendMessage('Simulation saved to database')

      await loadHistory()
    } catch (error) {
      setErrorMessage(error.message || 'Simulation failed.')
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }, [loadHistory, normalizeMetrics])

  useEffect(() => {
    if (!running) return undefined

    const timer = window.setInterval(() => {
      simulate()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [running, simulate])

  const reset = async () => {
    setRunning(false)
    setSelectedDistrict(null)
    setActivePage('Overview')
    await loadDashboard()
    await loadPredictions()
  }

  const exportCSV = () => {
    const headers = ['Update', 'Time', 'Traffic', 'AQI', 'Energy', 'Water']

    const rows = history.map(row => [
      row.update,
      row.time,
      row.traffic,
      row.aqi,
      row.energy,
      row.water,
    ])

    const csv = [headers, ...rows]
      .map(row =>
        row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
      )
      .join('\r\n')

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'citypulse-history.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const traffic = Number(
    metrics.find(metric => metric.name === 'Traffic flow')?.value ?? 0
  )
  const aqi = Number(
    metrics.find(metric => metric.name === 'Air quality')?.value ?? 0
  )
  const energy = Number(
    metrics.find(metric => metric.name === 'Energy usage')?.value ?? 0
  )
  const water = Number(
    metrics.find(metric => metric.name === 'Water reserves')?.value ?? 0
  )

  const alerts = []

  if (traffic < 40) {
    alerts.push('🚦 Traffic flow is low. Review congestion and signal timing.')
  }
  if (aqi > 100) {
    alerts.push('🌿 Air quality is poor. Consider pollution-response measures.')
  }
  if (energy > 85) {
    alerts.push('⚡ Energy demand is high. Review peak-load management.')
  }
  if (water < 30) {
    alerts.push('💧 Water reserves are low. Review conservation measures.')
  }

  const pages = [
    'Overview',
    'Mobility',
    'Environment',
    'Energy grid',
    'Water network',
  ]

  const pageTitles = {
    Overview: 'Your city, in real time.',
    Mobility: 'Urban mobility.',
    Environment: 'Environmental health.',
    'Energy grid': 'Energy operations.',
    'Water network': 'Water network.',
  }

  const visibleMetrics = metrics.filter(metric => {
    if (activePage === 'Mobility') return metric.name === 'Traffic flow'
    if (activePage === 'Environment') return metric.name === 'Air quality'
    if (activePage === 'Energy grid') return metric.name === 'Energy usage'
    if (activePage === 'Water network') return metric.name === 'Water reserves'
    return true
  })

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">C<span>●</span></div>
        <div className="brand-name">CityPulse <span>AI</span></div>
        <p className="side-label">SMART CITY PLATFORM</p>

        {pages.map((page, index) => (
          <button
            key={page}
            className={`nav-item ${activePage === page ? 'active' : ''}`}
            onClick={() => setActivePage(page)}
          >
            {['▦', '🚦', '🌿', '⚡', '💧'][index]} &nbsp; {page}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="status-dot" />
          {running ? 'Simulation engine running' : 'Simulation paused'}
          <p>CityPulse AI · v1.0</p>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              CITY INTELLIGENCE / {activePage.toUpperCase()}
            </span>
            <h1>{pageTitles[activePage]}</h1>
            <p className="muted">
              Monitor simulated urban conditions and city health.
            </p>
            <p className="muted">
              Backend: <strong>{backendStatus}</strong>
              {backendMessage ? ` · ${backendMessage}` : ''}
            </p>
            {lastBackendUpdate && (
              <p className="muted">
                API data loaded: {new Date(lastBackendUpdate).toLocaleString()}
              </p>
            )}
          </div>

          <div className="top-actions">
            <span className="live-pill">
              <span className="status-dot" />
              {running ? 'SIMULATED LIVE' : 'PAUSED'}
            </span>
            <button className="reset-btn" onClick={reset}>
              ↻ Refresh data
            </button>
          </div>
        </header>

        {errorMessage && (
          <section className="panel" role="alert">
            <h2>⚠ Connection notice</h2>
            <p>{errorMessage}</p>
            <button className="reset-btn" onClick={loadDashboard}>
              Retry connection
            </button>
          </section>
        )}

        <section className="panel" role="status">
          <h2>⚠ City alerts</h2>
          {alerts.length > 0 ? (
            alerts.map(alert => <p key={alert}>{alert}</p>)
          ) : (
            <p>✅ All city indicators are within the configured demo thresholds.</p>
          )}
        </section>

        <section className="welcome-panel">
          <div>
            <span className="eyebrow">CITY OPERATIONS CENTER</span>
            <h2>Good evening, City Operator.</h2>
            <p>
              Monitor city systems, explore district activity, and simulate
              changing urban conditions.
            </p>
          </div>

          <div className="city-art" aria-hidden="true">
            <div className="sun" />
            <div className="building b1" />
            <div className="building b2" />
            <div className="building b3" />
            <div className="building b4" />
            <div className="building b5" />
            <div className="road" />
          </div>
        </section>

        <div className="section-heading">
          <div>
            <h2>
              {activePage === 'Overview'
                ? 'City health indicators'
                : `${activePage} indicators`}
            </h2>
            <p className="muted">Key metrics across the urban network</p>
          </div>
          <span className="updated">UPDATES: {history.length}</span>
        </div>

<section className="panel ai-predictions-panel">
  <div className="panel-heading">
    <div>
      <h2>🤖 AI Predictions</h2>
      <p>Random Forest model · Historical data</p>
    </div>
    <button
      className="reset-btn"
      onClick={loadPredictions}
      disabled={predictionsLoading}
    >
      {predictionsLoading ? "Loading..." : "Refresh AI"}
    </button>
  </div>

  {predictionError && (
    <p role="alert">{predictionError}</p>
  )}

  {!predictionError && predictions.length === 0 && (
    <p>
      {predictionsLoading
        ? "Generating predictions..."
        : "Click Refresh AI to load predictions."}
    </p>
  )}

  <div className="metrics-grid">
    {predictions.map((item) => (
      <article className="metric-card" key={item.name}>
        <p className="metric-name">{item.name}</p>
        <div className="metric-value">
          {Number.isFinite(Number(item.prediction))
            ? Number(item.prediction).toFixed(2)
            : "—"}
        </div>
        <p className="metric-foot">
          {item.model || "AI model"} · {item.readings ?? 0} readings
        </p>
      </article>
    ))}
  </div>
</section>

        <section className="metrics-grid">
          {visibleMetrics.map((metric, index) => (
            <article className="metric-card" key={metric.name}>
              <div className="metric-top">
                <span className="metric-icon">{metric.icon}</span>
                <span className="metric-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="metric-name">{metric.name}</p>
              <div className="metric-value">
                {metric.value}<small>{metric.unit}</small>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(Math.max(metric.value, 0), 100)}%`,
                    background: metric.color,
                  }}
                />
              </div>
              <p className="metric-foot">
                ● {lastBackendUpdate ? 'Backend data' : 'Waiting for backend'}
              </p>
            </article>
          ))}
        </section>

        {activePage === 'Overview' && (
          <>
            <section className="lower-grid">
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Urban activity map</h2>
                    <p className="muted">Select a district to inspect it</p>
                  </div>
                  <span className="map-tag">DEMO MAP</span>
                </div>

                <div className="city-map">
                  <div className="map-road road-a" />
                  <div className="map-road road-b" />
                  <div className="map-road road-c" />
                  <div className="map-road road-d" />

                  {districts.map(zone => (
                    <button
                      key={zone.short}
                      className="map-zone"
                      style={{ left: zone.left, top: zone.top }}
                      onClick={() => setSelectedDistrict(zone)}
                      aria-label={`Select ${zone.name}`}
                    >
                      <span style={{ background: zone.color }} />
                      <small>{zone.short}</small>
                    </button>
                  ))}
                </div>

                {selectedDistrict && (
                  <div className="recommendation">
                    <strong>{selectedDistrict.name}</strong>
                    <p>District selected. City traffic flow is {traffic}%.</p>
                    <button
                      className="reset-btn"
                      onClick={() => setSelectedDistrict(null)}
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                <div className="map-legend">
                  <span>● Normal activity</span>
                  <span>● High activity</span>
                  <span>● Service zone</span>
                </div>
              </article>

              <article className="panel ai-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">CITYPULSE INTELLIGENCE</span>
                    <h2>AI insights</h2>
                  </div>
                  <span className="sparkle">✳</span>
                </div>

                <div className="insight">
                  <span className="insight-icon">🚦</span>
                  <div>
                    <strong>Mobility watch</strong>
                    <p>
                      Traffic flow is {traffic}%.{' '}
                      {traffic < 40
                        ? 'Congestion response may be needed.'
                        : 'Monitor signal timing in busy districts.'}
                    </p>
                  </div>
                </div>

                <div className="insight">
                  <span className="insight-icon">🌱</span>
                  <div>
                    <strong>Environment watch</strong>
                    <p>
                      AQI reading is {aqi}.{' '}
                      {aqi > 100
                        ? 'Consider pollution-response measures.'
                        : 'Continue monitoring air quality trends.'}
                    </p>
                  </div>
                </div>

                <div className="insight">
                  <span className="insight-icon">⚡</span>
                  <div>
                    <strong>Energy watch</strong>
                    <p>
                      Energy usage is {energy}%.{' '}
                      {energy > 85
                        ? 'High demand detected.'
                        : 'Energy demand is within the demo monitoring range.'}
                    </p>
                  </div>
                </div>

                <div className="insight">
                  <span className="insight-icon">💧</span>
                  <div>
                    <strong>Water watch</strong>
                    <p>
                      Water reserves are {water}%.{' '}
                      {water < 30
                        ? 'Conservation measures may be needed.'
                        : 'Water reserves are within the demo monitoring range.'}
                    </p>
                  </div>
                </div>

                <div className="recommendation">
                  <span>✦ RECOMMENDED ACTION</span>
                  <p>
                    {alerts.length
                      ? 'Review active alerts and prioritize affected systems.'
                      : 'Continue monitoring city indicators and prepare for peak demand.'}
                  </p>
                </div>

                <p className="demo-note">
                  Rule-based demo insights; no external AI or live sensor connection.
                </p>
              </article>
            </section>

            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>City trends</h2>
                  <p className="muted">
                    All readings · {history.length} saved records
                  </p>
                </div>
                <span className="map-tag">DATABASE HISTORY</span>
              </div>

              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#273449" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="update"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="traffic" name="Traffic %" stroke="#6ee7b7" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="aqi" name="Air quality AQI" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="energy" name="Energy %" stroke="#a78bfa" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="water" name="Water %" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="demo-note">
                Chart displays all records returned by the backend.
              </p>
            </section>

            <section className="panel history-panel">
              <div className="panel-heading">
                <div>
                  <h2>Simulation history</h2>
                  <p className="muted">All saved readings from the database</p>
                </div>
                <div className="top-actions">
                  <span className="map-tag">{history.length} RECORDS</span>
                  <button className="simulate-btn" onClick={exportCSV}>
                    ↓ Export CSV
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      {['Update', 'Time', 'Traffic', 'AQI', 'Energy', 'Water'].map(label => (
                        <th
                          key={label}
                          style={{
                            padding: '12px 10px',
                            color: '#94a3b8',
                            borderBottom: '1px solid #273449',
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map(row => (
                      <tr key={`${row.update}-${row.time}`}>
                        <td style={{ padding: '12px 10px' }}>#{row.update}</td>
                        <td style={{ padding: '12px 10px' }}>{row.time}</td>
                        <td style={{ padding: '12px 10px' }}>{row.traffic}%</td>
                        <td style={{ padding: '12px 10px' }}>{row.aqi}</td>
                        <td style={{ padding: '12px 10px' }}>{row.energy}%</td>
                        <td style={{ padding: '12px 10px' }}>{row.water}%</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '18px 10px' }}>
                          No saved simulations yet. Click Run simulation to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="simulation-bar">
          <div>
            <span className="simulation-icon">⟳</span>
            <div>
              <strong>City simulation</strong>
              <p className="muted">
                {running
                  ? 'New readings are saved every 5 seconds.'
                  : 'Automatic simulation is paused.'}
              </p>
            </div>
          </div>

          <div className="top-actions">
            <button
              className="reset-btn"
              onClick={() => setRunning(value => !value)}
            >
              {running ? 'Ⅱ Pause' : '▶ Start auto'}
            </button>
            <button
              className="simulate-btn"
              onClick={simulate}
              disabled={busy}
            >
              {busy ? 'Saving...' : '▶ Run simulation'}
            </button>
          </div>
        </section>

        <footer>
          CityPulse AI <span>·</span> Smart city digital twin concept
          <span>·</span> Demo data only
        </footer>
      </section>
    </main>
  )
}

export default App