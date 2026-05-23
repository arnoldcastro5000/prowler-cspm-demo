import type { Finding } from '../types/finding'

interface Props {
  before: Finding[]
  after: Finding[]
}

const severityOrder = ['critical', 'high', 'medium', 'low']

const severityBadge: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

const providerBadge: Record<string, string> = {
  aws: 'bg-orange-50 text-orange-800',
  gcp: 'bg-blue-50 text-blue-800',
  azure: 'bg-sky-50 text-sky-800',
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
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Remediation Changelog —{' '}
        <span className="text-green-600">{resolved.length} issue{resolved.length !== 1 ? 's' : ''} resolved</span>
      </h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Check ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status Change</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map(f => (
              <tr key={f.id} className="border-b border-gray-100">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${providerBadge[f.provider]}`}>
                    {f.provider}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severityBadge[f.severity]}`}>
                    {f.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 capitalize">{f.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{f.check_id}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{f.title}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-red-600">FAIL</span>
                  <span className="text-xs text-gray-400 mx-1">→</span>
                  <span className="text-xs font-medium text-green-600">PASS</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
