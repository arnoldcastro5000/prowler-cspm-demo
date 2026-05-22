import { useState } from 'react'
import type { Finding } from '../types/finding'

interface Props {
  finding: Finding
}

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

const statusBadge: Record<string, string> = {
  fail: 'bg-red-100 text-red-700',
  pass: 'bg-green-100 text-green-700',
}

export default function FindingRow({ finding }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${providerBadge[finding.provider]}`}>
            {finding.provider}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severityBadge[finding.severity]}`}>
            {finding.severity}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{finding.title}</td>
        <td className="px-4 py-3 text-xs font-mono text-gray-500 max-w-xs truncate" title={finding.resource}>
          {finding.resource}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${statusBadge[finding.status]}`}>
            {finding.status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-200">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Category</span>
                <p className="text-gray-700 capitalize">{finding.category}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Check ID</span>
                <p className="font-mono text-gray-700 text-xs">{finding.check_id}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Scanned at</span>
                <p className="text-gray-700">{new Date(finding.scanned_at).toLocaleString()}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
