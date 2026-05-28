import { NavLink, useLocation } from 'react-router-dom'

export default function TabBar() {
  const base = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors'
  const active = 'border-blue-400 text-blue-400'
  const inactive = 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'

  const { pathname } = useLocation()
  const cspmActive = pathname === '/before' || pathname === '/after'
  const securityActive = pathname === '/security' || pathname === '/threat-model'
  const frameworksActive = pathname === '/owasp-top-10' || pathname === '/owasp-cicd' || pathname === '/owasp-llm' || pathname === '/owasp-genai'

  return (
    <div className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 flex gap-0 items-center">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          Home
        </NavLink>
        <div className="relative group flex">
          <NavLink
            to="/before"
            className={`${base} ${cspmActive ? active : inactive}`}
          >
            CSPM
          </NavLink>
          <div className="absolute left-0 top-full hidden group-hover:block bg-gray-900 border border-gray-700 rounded-b-md shadow-lg z-10 min-w-[120px]">
            <NavLink
              to="/before"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              Before
            </NavLink>
            <NavLink
              to="/after"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              After
            </NavLink>
          </div>
        </div>
        <div className="relative group flex">
          <NavLink
            to="/security"
            className={`${base} ${securityActive ? active : inactive}`}
          >
            Posture
          </NavLink>
          <div className="absolute left-0 top-full hidden group-hover:block bg-gray-900 border border-gray-700 rounded-b-md shadow-lg z-10 min-w-[140px]">
            <NavLink
              to="/security"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              Security Controls
            </NavLink>
            <NavLink
              to="/threat-model"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              Threat Model
            </NavLink>
          </div>
        </div>
        <NavLink
          to="/architecture"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        >
          Architecture
        </NavLink>
        <div className="relative group flex">
          <NavLink
            to="/owasp-top-10"
            className={`${base} ${frameworksActive ? active : inactive}`}
          >
            Standards
          </NavLink>
          <div className="absolute left-0 top-full hidden group-hover:block bg-gray-900 border border-gray-700 rounded-b-md shadow-lg z-10 min-w-[160px]">
            <NavLink
              to="/owasp-top-10"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              OWASP Top 10
            </NavLink>
            <NavLink
              to="/owasp-cicd"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              OWASP Top 10 CI/CD
            </NavLink>
            <NavLink
              to="/owasp-llm"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              OWASP Top 10 LLM
            </NavLink>
            <NavLink
              to="/owasp-genai"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'text-blue-400 bg-blue-950' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              OWASP Gen-AI
            </NavLink>
          </div>
        </div>
        <a
          href="https://github.com/arnoldcastro5000/prowler-cspm-demo"
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600`}
        >
          GitHub
        </a>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://www.linkedin.com/in/arnoldgcastro/"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            className="flex items-center justify-center w-8 h-8 rounded text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a
            href="https://github.com/arnoldcastro5000"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="flex items-center justify-center w-8 h-8 rounded text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
