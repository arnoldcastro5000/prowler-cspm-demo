import type { Finding } from '../types/finding'

interface Props {
  findings: Finding[]
  scannedAt: string
}

const severities = ['critical', 'high', 'medium', 'low'] as const

const severityColors: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-gray-500',
}

export default function Scorecard({ findings, scannedAt }: Props) {
  const fails = findings.filter(f => f.status === 'fail')
  const counts = Object.fromEntries(
    severities.map(s => [s, fails.filter(f => f.severity === s).length])
  )

  const date = new Date(scannedAt).toLocaleString()

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs text-gray-500 mb-3">Scanned at {date}</p>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-100">{fails.length}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Fail</p>
          </div>
          {severities.map(s => (
            <div key={s} className="text-center">
              <p className={`text-2xl font-bold ${severityColors[s]}`}>{counts[s]}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
