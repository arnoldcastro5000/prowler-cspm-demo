import type { Finding } from '../types/finding'
import FindingRow from './FindingRow'

interface Props {
  findings: Finding[]
}

const providers = ['aws', 'gcp', 'azure'] as const
const severityOrder = ['critical', 'high', 'medium', 'low']

function sortBySeverity(findings: Finding[]) {
  return [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  )
}

export default function FindingsTable({ findings }: Props) {
  if (findings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No findings match the current filter.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {providers.map(provider => {
        const group = sortBySeverity(findings.filter(f => f.provider === provider))
        if (group.length === 0) return null
        return (
          <div key={provider}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {provider.toUpperCase()} - {group.length} check{group.length !== 1 ? 's' : ''}
            </h3>
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Provider</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Resource</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(f => <FindingRow key={f.id} finding={f} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
