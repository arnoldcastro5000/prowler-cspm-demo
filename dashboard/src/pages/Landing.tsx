import TabBar from '../components/TabBar'
import PipelineDiagram from '../components/PipelineDiagram'

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
          <p className="text-xl text-gray-300 leading-relaxed mb-4">
            Cloud misconfiguration is the{' '}
            <a
              href="https://www.rsaconference.com/library/blog/cloud-misconfigurations-still-the-biggest-threat-in-2025"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300"
            >
              #1 cloud security threat
            </a>
            {' '}— the average breach costs <span className="text-white font-semibold">$4.3 million</span> and
            takes over 180 days to detect. This project demonstrates end-to-end detection
            and remediation across AWS, GCP, and Azure using real Prowler scans against
            live infrastructure.
          </p>
          <p className="text-xl text-gray-300 leading-relaxed">
            19 failures found. 19 fixed after remediation.
          </p>
        </div>

        {/* Credibility */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">What makes it real</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3"><span className="text-blue-400">→</span>Terraform-provisioned infrastructure toggled between misconfigured and hardened states via <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">before.tfvars</code> / <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">after.tfvars</code></li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>All cloud credentials stored in GCP Secret Manager — fetched at runtime, never on disk</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Prowler runs locally on WSL2, output ingested and normalised to a typed JSON schema</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Findings baked into the container at build time</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Hosted on GCP Cloud Run, proxied through Cloudflare (edge security &amp; delivery)</li>
          </ul>

        </div>

        {/* Infrastructure diagram */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Pipeline</h2>
          <div className="bg-gray-900 rounded-lg p-6">
            <PipelineDiagram />
          </div>

          {/* Security boundary callout */}
          <div className="mt-6 border border-gray-600/50 bg-gray-800/40 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Defence in depth</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              All traffic routes through Cloudflare only. Direct backend access is blocked by a shared secret.
            </p>
            <p className="text-gray-500 text-xs mt-2 font-mono">
              User → Cloudflare edge (WAF · CDN · DDoS) → Cloudflare Worker (injects X-CF-Secret) → Cloud Run (direct access blocked)
            </p>
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
                  ['Scanner', 'Prowler 5.27.0'],
                  ['IaC', 'Terraform ≥ 1.6'],
                  ['Ingest', 'Python 3.11'],
                  ['Frontend', 'React 18 + Vite + TypeScript (strict) + Tailwind + zod'],
                  ['Hosting', 'GCP Cloud Run'],
                  ['Edge', 'Cloudflare | CDN, WAF, DDoS protection, DNS'],
                  ['Secrets', 'GCP Secret Manager'],
                  ['Registry', 'GCP Artifact Registry'],
                  ['AI Development', 'Claude Code (sandboxed) + andrej-karpathy-skills + mattpocock/skills'],
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

        {/* CI status badges */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">CI Status</h2>
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Workflow</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  ['Frontend CI', 'frontend-ci.yml'],
                  ['Docker Build', 'docker-build.yml'],
                  ['Terraform Validate', 'terraform-validate.yml'],
                  ['Python Lint', 'python-lint.yml'],
                  ['Shellcheck', 'shellcheck.yml'],
                  ['Secret Scan', 'secret-scan.yml'],
                  ['Trivy', 'trivy.yml'],
                  ['Zizmor', 'zizmor.yml'],
                  ['Hardcoded Config Check', 'hardcoded-config-check.yml'],
                  ['Dependency Review', 'dependency-review.yml'],
                ].map(([name, file]) => (
                  <tr key={file} className="bg-gray-950">
                    <td className="px-4 py-2 text-gray-400">{name}</td>
                    <td className="px-4 py-2">
                      <a
                        href={`https://github.com/arnoldcastro5000/prowler-cspm-demo/actions/workflows/${file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={`https://github.com/arnoldcastro5000/prowler-cspm-demo/actions/workflows/${file}/badge.svg`}
                          alt={`${name} status`}
                        />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
