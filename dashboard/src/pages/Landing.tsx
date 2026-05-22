import { Link } from 'react-router-dom'
import TabBar from '../components/TabBar'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="bg-white">
        <TabBar />
      </div>
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Hero */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Prowler CSPM</h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Real Prowler scans against live AWS, GCP, and Azure infrastructure — not mocked data.
            15 checks across 5 security categories, with full before/after remediation.
          </p>
        </div>

        {/* Credibility */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">What makes it real</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3"><span className="text-blue-400">→</span>Terraform-provisioned infrastructure toggled between misconfigured and hardened states via <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">before.tfvars</code> / <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">after.tfvars</code></li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>All cloud credentials stored in GCP Secret Manager — fetched at runtime, never on disk</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Prowler runs locally on WSL2, output ingested and normalised to a typed JSON schema</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Findings baked into the container at build time — no backend, no API, no database</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Hosted on GCP Cloud Run, proxied through Cloudflare (WAF · CDN · DDoS · Full Strict SSL)</li>
          </ul>
        </div>

        {/* Infrastructure diagram */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Pipeline</h2>
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-xs text-gray-300 overflow-auto">
            <pre>{`Terraform (WSL2)
  ├── AWS resources        ─┐
  ├── GCP resources         ├─ before.tfvars / after.tfvars
  └── Azure resources      ─┘
          │
          ▼
Prowler scan (WSL2)
  ├── 5 AWS checks
  ├── 5 GCP checks
  └── 5 Azure checks
          │
          ▼
ingest_prowler.py → findings_before.json / findings_after.json
          │
          ▼
Docker build (JSON baked in) → GCP Artifact Registry
          │
          ▼
GCP Cloud Run ← Cloudflare (CDN · WAF · DDoS)
                prowler.cloudsecuritypractice.com`}</pre>
          </div>
        </div>

        {/* Tech stack */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Tech stack</h2>
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Layer</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Technology</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  ['CI/CD', 'GitHub Actions + Dependabot'],
                  ['Scanner', 'Prowler (open source)'],
                  ['IaC', 'Terraform ≥ 1.6'],
                  ['Ingest', 'Python 3.11'],
                  ['Frontend', 'React 18 + Vite + TypeScript (strict) + Tailwind + zod'],
                  ['Hosting', 'GCP Cloud Run'],
                  ['Edge', 'Cloudflare (free tier)'],
                  ['Secrets', 'GCP Secret Manager'],
                  ['Registry', 'GCP Artifact Registry'],
                ].map(([layer, tech]) => (
                  <tr key={layer} className="bg-gray-950">
                    <td className="px-4 py-2 text-gray-400">{layer}</td>
                    <td className="px-4 py-2 text-gray-200">{tech}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-4 flex-wrap">
          <Link
            to="/before"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            View Before Scan →
          </Link>
          <Link
            to="/after"
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            View After Scan →
          </Link>
          <a
            href="https://github.com/arnoldcastro5000/prowler-cspm-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            GitHub →
          </a>
        </div>

      </div>
    </div>
  )
}
