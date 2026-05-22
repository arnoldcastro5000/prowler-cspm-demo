type Severity = 'all' | 'critical' | 'high' | 'medium' | 'low'

interface Props {
  value: Severity
  onChange: (v: Severity) => void
}

const options: Severity[] = ['all', 'critical', 'high', 'medium', 'low']

const colors: Record<Severity, string> = {
  all: 'bg-gray-100 text-gray-700 border-gray-300',
  critical: 'bg-red-50 text-red-700 border-red-300',
  high: 'bg-orange-50 text-orange-700 border-orange-300',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  low: 'bg-gray-50 text-gray-600 border-gray-300',
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
      <span className="text-xs text-gray-500 uppercase tracking-wide">Severity</span>
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
