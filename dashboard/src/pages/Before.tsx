import { useState, useEffect } from 'react'
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
    <div className="min-h-screen bg-gray-50">
      <TabBar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Before Remediation</h1>

        {loading && (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
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
