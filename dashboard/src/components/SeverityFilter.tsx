type Severity = 'all' | 'critical' | 'high' | 'medium' | 'low'

interface Props {
  value: Severity
  onChange: (v: Severity) => void
}

const options: Severity[] = ['all', 'critical', 'high', 'medium', 'low']

const colors: Record<Severity, string> = {
  all: 'bg-gray-800 text-gray-300 border-gray-700',
  critical: 'bg-red-950 text-red-400 border-red-800',
  high: 'bg-orange-950 text-orange-400 border-orange-800',
  medium: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  low: 'bg-gray-800 text-gray-400 border-gray-700',
}

const activeColors: Record<Severity, string> = {
  all: 'bg-gray-700 text-white border-gray-700',
  critical: 'bg-red-600 text-white border-red-600',
  high: 'bg-orange-500 text-white border-orange-500',
  medium: 'bg-yellow-500 text-white border-yellow-500',
  low: 'bg-gray-500 text-white border-gray-500',
}

export default function SeverityFilter({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <span className="text-xs text-gray-400 uppercase tracking-wide">Severity</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-xs font-medium rounded border transition-colors capitalize
            ${value === opt ? activeColors[opt] : colors[opt]}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
