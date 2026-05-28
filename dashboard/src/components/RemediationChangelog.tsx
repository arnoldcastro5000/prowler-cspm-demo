import type { Finding } from '../types/finding'

interface Props {
  before: Finding[]
  after: Finding[]
}

const severityOrder = ['critical', 'high', 'medium', 'low']

const severityBadge: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-400',
  high: 'bg-orange-900/50 text-orange-400',
  medium: 'bg-yellow-900/50 text-yellow-400',
  low: 'bg-gray-700 text-gray-400',
}

const providerBadge: Record<string, string> = {
  aws: 'border-blue-500 text-blue-400',
  gcp: 'border-blue-500 text-blue-400',
  azure: 'border-blue-500 text-blue-400',
}

export default function RemediationChangelog({ before, after }: Props) {
  const afterFailIds = new Set(
    after.filter(f => f.status === 'fail').map(f => f.check_id)
  )

  const resolved = before
    .filter(f => f.status === 'fail' && !afterFailIds.has(f.check_id))
    .sort((a, b) => {
      const si = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
      return si !== 0 ? si : a.provider.localeCompare(b.provider)
    })

  if (resolved.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No remediated findings to display.
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-100 mb-3">
        Remediation Changelog —{' '}
        <span className="text-green-600">{resolved.length} issue{resolved.length !== 1 ? 's' : ''} resolved</span>
      </h2>
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Provider</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Check ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Status Change</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map(f => (
              <tr key={f.id} className="border-b border-gray-800">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-medium uppercase ${providerBadge[f.provider]}`}>
                    {f.provider}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severityBadge[f.severity]}`}>
                    {f.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 capitalize">{f.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.check_id}</td>
                <td className="px-4 py-3 text-sm text-gray-200">{f.title}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-red-400">FAIL</span>
                  <span className="text-xs text-gray-500 mx-1">→</span>
                  <span className="text-xs font-medium text-green-400">PASS</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
