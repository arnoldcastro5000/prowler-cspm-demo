import { useState, useEffect } from 'react'
import TabBar from '../components/TabBar'

const RAW_URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/security.md'

export default function Security() {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(RAW_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(setContent)
      .catch(() => setError('Failed to load security controls document.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <TabBar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-full" />
            ))}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed bg-white border border-gray-200 rounded-lg p-6 overflow-auto">
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}
