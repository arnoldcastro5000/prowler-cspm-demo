import TabBar from '../components/TabBar'
import PipelineDiagram from '../components/PipelineDiagram'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TabBar />
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Hero */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Prowler CSPM</h1>
          <p className="text-xl italic text-gray-300 leading-relaxed mb-4">
            Cloud misconfiguration is the{' '}
            <a
              href="https://www.rsaconference.com/library/blog/cloud-misconfigurations-still-the-biggest-threat-in-2025"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300"
            >
              #1 cloud security threat
            </a>
            {' '}— the average breach costs <span className="text-white font-semibold">CAD 5.95 million</span> and
            takes over <span className="text-white font-semibold">180 days to detect</span>.
          </p>
          <p className="text-xl text-gray-300 leading-relaxed mb-4">
            This proof-of-concept demonstrates three security capabilities an organization needs in place
            before pushing workloads to the cloud:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-xl text-gray-300 leading-relaxed mb-4">
            <li><span className="text-white font-semibold">Cloud Security Posture Management</span> — a repeatable pattern for detecting and remediating misconfigurations across AWS, GCP, and Azure</li>
            <li><span className="text-white font-semibold">Secure cloud architecture</span> — defence-in-depth deployment for web applications</li>
            <li><span className="text-white font-semibold">Secure AI-assisted development</span> — sandboxed agentic coding with auditable CI guardrails on every change</li>
          </ol>
          <p className="text-xl text-gray-300 leading-relaxed mb-4">
            <span className="text-white font-semibold">Outcomes:</span>
          </p>
          <ol className="list-decimal list-inside space-y-2 text-xl text-gray-300 leading-relaxed">
            <li><span className="text-white font-semibold">CSPM</span> — 19 of 19 misconfigurations remediated across AWS, GCP, and Azure (100% closure rate, verified by re-scan)</li>
            <li><span className="text-white font-semibold">Secure cloud architecture</span> — This dashboard deployed behind Cloudflare WAF + DDoS protection; it is accessible only through Cloudflare</li>
            <li><span className="text-white font-semibold">Secure AI-assisted development</span> — POC built with a sandboxed AI agent; every change passes 13 automated CI security gates before merge</li>
          </ol>
        </div>

        {/* Credibility */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">What makes it real</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3"><span className="text-blue-400">→</span>Container image hardened — runs as non-root, CVE-scanned on every CI build, deployed by immutable digest</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>All cloud credentials stored in GCP Secret Manager — fetched at runtime, never on disk</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Every code change is automatically checked for security issues before it ships</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Terraform-provisioned infrastructure toggled between misconfigured and hardened states via <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">before.tfvars</code> / <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">after.tfvars</code></li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Prowler scans run in an isolated local environment — findings are normalised to a strict typed schema before publishing</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>Security headers hardening on the frontend — mitigating common web vulnerabilities</li>
            <li className="flex gap-3"><span className="text-blue-400">→</span>This dashboard is hosted on GCP Cloud Run, secured through Cloudflare</li>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">How traffic is secured</p>
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
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-900">
                <tr>
                  <th className="w-1/5 px-4 py-2 text-left text-xs text-gray-500 uppercase">Layer</th>
                  <th className="w-2/5 px-4 py-2 text-left text-xs text-gray-500 uppercase">Technology</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {([
                  ['Cloud environments tested', 'AWS, GCP, Azure', 'Demonstrates multi-cloud coverage in a single pipeline'],
                  ['Scanner', <><a href="https://github.com/prowler-cloud/prowler" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Prowler</a> 5.27.0</>, 'Native multi-cloud CSPM with structured JSON output'],
                  ['IaC', 'Terraform ≥ 1.6', 'Reproducible before/after infrastructure states via tfvars toggle'],
                  ['Dashboard hosting', 'GCP Cloud Run', 'Serverless containers with scale-to-zero'],
                  ['Edge', 'Cloudflare | CDN, WAF, DDoS protection, DNS', 'Full edge security layer; origin access blocked without shared secret'],
                  ['Secrets', 'GCP Secret Manager', 'All cloud credentials fetched at runtime, never stored on disk'],
                  ['Registry', 'GCP Artifact Registry', 'Docker image storage, GCP-native'],
                  ['AI Development', <>Claude Code (sandboxed) + <a href="https://github.com/multica-ai/andrej-karpathy-skills" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">andrej-karpathy-skills</a> + <a href="https://github.com/mattpocock/skills" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">mattpocock/skills</a></>, 'Agentic workflows (TDD, domain grilling, issue breakdown) with LLM coding guardrails'],
                  ['CI/CD', 'GitHub Actions + Dependabot + Socket.dev', '13 automated checks block unsafe code before it ships + weekly dependency updates'],
                  ['Frontend', 'React 18 + Vite + TypeScript (strict) + Tailwind + zod', 'Static bundle with runtime schema validation, containerises cleanly'],
                  ['Development environment', 'WSL2 (Windows Subsystem for Linux)', 'Local Linux environment for Terraform, Prowler, and Docker'],
                  ['Architecture diagrams', <><a href="https://github.com/vidanov/aws-architecture-diagram-skill" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">/aws-architecture-diagram</a> skill</>, 'Generates validated draw.io architecture diagrams using official AWS4 icon libraries'],
                ] as [string, React.ReactNode, string][]).map(([layer, tech, rationale]) => (
                  <tr key={layer} className="bg-gray-950">
                    <td className="px-4 py-2 text-gray-400">{layer}</td>
                    <td className="px-4 py-2 text-gray-200">{tech}</td>
                    <td className="px-4 py-2 text-gray-400">{rationale}</td>
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
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-900">
                <tr>
                  <th className="w-1/5 px-4 py-2 text-left text-xs text-gray-500 uppercase">Workflow</th>
                  <th className="w-2/5 px-4 py-2 text-left text-xs text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">What it protects against</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {([
                  ['Semgrep SAST', 'semgrep.yml', 'Scans the dashboard and Cloudflare Worker source files (.ts, .tsx, .js) for injection and cross-site scripting (XSS) issues'],
                  ['Python Lint (Ruff · Bandit)', 'python-lint.yml', 'Scans the Python ingest code for security flaws and code-quality issues before they ship'],
                  ['Secret Scan (Gitleaks)', 'secret-scan.yml', 'Scans every commit and the full git history for leaked credentials, API keys, and tokens before they reach the public repo'],
                  ['Hardcoded Config Check (custom grep)', 'hardcoded-config-check.yml', 'Blocks cloud account IDs, resource identifiers, regions, and personal emails from being hardcoded in source code'],
                  ['Dependency Review (GitHub)', 'dependency-review.yml', 'Flags any newly added or updated dependency with known security vulnerabilities before it merges'],
                  ['Socket.dev', null, 'Scans npm package manifests (package.json, package-lock.json) for malware, typosquatting, obfuscated code, and other supply-chain compromise indicators before dependencies are approved for merge'],
                  ['Trivy', 'trivy.yml', 'Scans the Terraform for insecure infrastructure patterns — public exposure, missing encryption, weak access — before it reaches live infrastructure'],
                  ['Zizmor', 'zizmor.yml', 'Audits the GitHub Actions workflows for CI/CD security flaws — script injection, over-broad permissions, unpinned actions'],
                  ['Worker Lint (ESLint)', 'worker-lint.yml', 'Lints the Cloudflare Worker — the edge security layer — catching JavaScript errors before it ships to the edge'],
                  ['Frontend CI (TypeScript · ESLint · Vite · lockfile-lint)', 'frontend-ci.yml', 'Validates lockfile integrity against the official npm registry (supply-chain) and catches type errors, code-quality issues, and broken builds in the dashboard TypeScript source (.ts, .tsx) before they reach the live site'],
                  ['Shellcheck', 'shellcheck.yml', 'Catches shell-scripting bugs and unsafe quoting in the scan automation before they cause silent failures'],
                  ['Terraform Validate', 'terraform-validate.yml', 'Catches malformed Terraform — invalid syntax, type errors, and broken references — before an apply touches live cloud infrastructure'],
                  ['Docker Build', 'docker-build.yml', 'Builds the image and scans it with Trivy for CRITICAL and HIGH CVEs (fixable only); SARIF results go to the GitHub Security tab. Catches build errors and known vulnerabilities before deployment.'],
                ] as [string, string | null, string][]).map(([name, file, description]) => (
                  <tr key={name} className="bg-gray-950">
                    <td className="px-4 py-2 text-gray-400">{name}</td>
                    <td className="px-4 py-2">
                      {file ? (
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
                      ) : (
                        <span className="text-xs text-green-400 font-medium">Active · GitHub App</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-400">{description}</td>
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
