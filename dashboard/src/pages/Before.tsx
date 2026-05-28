import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { FindingSchema, type Finding } from '../types/finding'
import TabBar from '../components/TabBar'
import Scorecard from '../components/Scorecard'
import SeverityFilter from '../components/SeverityFilter'
import FindingsTable from '../components/FindingsTable'

type Severity = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function Before() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState<Severity>('all')

  useEffect(() => {
    fetch('/findings_before.json')
      .then(r => r.json())
      .then(d => setFindings(FindingSchema.array().parse(d)))
      .catch(() => setError('Failed to load findings. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }, [])

  const scannedAt = findings.length > 0
    ? findings.reduce((a, b) => a.scanned_at > b.scanned_at ? a : b).scanned_at
    : new Date().toISOString()

  const filtered = severity === 'all'
    ? findings
    : findings.filter(f => f.severity === severity)

  return (
    <div className="min-h-screen bg-gray-950">
      <TabBar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-100">Before Remediation</h1>
          <NavLink to="/after" className="text-lg text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1">
            After Remediation <span>→</span>
          </NavLink>
        </div>

        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-800 rounded" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-950 border border-red-800 rounded text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && (
          <>
            <Scorecard findings={findings} scannedAt={scannedAt} />
            <SeverityFilter value={severity} onChange={setSeverity} />
            <FindingsTable findings={filtered} />
          </>
        )}
      </div>
    </div>
  )
}
