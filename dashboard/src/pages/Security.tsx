import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
          <div className="prose prose-gray max-w-none bg-white border border-gray-200 rounded-lg p-8">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mt-8 mb-3">{children}</h2>,
                p: ({ children }) => <p className="text-gray-700 text-sm leading-relaxed mb-3">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ul>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                code: ({ children }) => <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">{children}</code>,
                hr: () => <hr className="my-6 border-gray-200" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm border border-gray-200 rounded">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                th: ({ children }) => <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2 text-gray-700 border-b border-gray-100">{children}</td>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
