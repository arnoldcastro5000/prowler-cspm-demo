import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TabBar from './TabBar'

interface Props {
  url: string
  errorLabel: string
}

export default function MarkdownDocPage({ url, errorLabel }: Props) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(setContent)
      .catch(() => setError(errorLabel))
      .finally(() => setLoading(false))
  }, [url, errorLabel])

  return (
    <div className="min-h-screen bg-gray-950">
      <TabBar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-800 rounded w-full" />
            ))}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-950 border border-red-800 rounded text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <div className="prose prose-invert max-w-none bg-gray-900 border border-gray-800 rounded-lg p-8">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-100 mb-4 pb-2 border-b border-gray-700">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-100 mt-8 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-gray-200 mt-6 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-300">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-300">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                code: ({ children }) => <code className="text-xs bg-gray-800 px-1 py-0.5 rounded font-mono text-gray-200">{children}</code>,
                hr: () => <hr className="my-6 border-gray-700" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm border border-gray-700 rounded">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
                th: ({ children }) => <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase border-b border-gray-700">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2 text-gray-300 border-b border-gray-800">{children}</td>,
                strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
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
