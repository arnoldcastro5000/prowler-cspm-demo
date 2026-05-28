import { useState } from 'react'
import type { Finding } from '../types/finding'

interface Props {
  finding: Finding
}

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

const statusBadge: Record<string, string> = {
  fail: 'bg-red-900/50 text-red-400',
  pass: 'bg-green-900/50 text-green-400',
}

export default function FindingRow({ finding }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium uppercase ${providerBadge[finding.provider]}`}>
            {finding.provider}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${severityBadge[finding.severity]}`}>
            {finding.severity}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-200">{finding.title}</td>
        <td className="px-4 py-3 text-xs font-mono text-gray-400 max-w-xs truncate" title={finding.resource}>
          {finding.resource}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${statusBadge[finding.status]}`}>
            {finding.status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-900 border-b border-gray-700">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
                <p className="text-gray-200 capitalize">{finding.category}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Check ID</span>
                <p className="font-mono text-gray-200 text-xs">{finding.check_id}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Scanned at</span>
                <p className="text-gray-200">{new Date(finding.scanned_at).toLocaleString()}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
