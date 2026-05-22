import { NavLink } from 'react-router-dom'

export default function TabBar() {
  const base = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors'
  const active = 'border-blue-500 text-blue-600'
  const inactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 flex gap-0">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          Home
        </NavLink>
        <NavLink
          to="/before"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          Before
        </NavLink>
        <NavLink
          to="/after"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          After
        </NavLink>
        <button
          disabled
          title="Coming soon"
          className={`${base} border-transparent text-gray-300 cursor-not-allowed`}
        >
          Frameworks
        </button>
      </div>
    </div>
  )
}
