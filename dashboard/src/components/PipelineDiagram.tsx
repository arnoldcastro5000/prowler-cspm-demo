export default function PipelineDiagram() {
  const box = 'flex flex-col items-center justify-center rounded-lg border px-4 py-3 text-center min-w-[120px]'
  const primary = `${box} bg-blue-950 border-blue-500 text-blue-100`
  const cloud = `${box} bg-gray-800 border-gray-500 text-gray-200`
  const infra = `${box} bg-indigo-950 border-indigo-500 text-indigo-100`
  const edge = `${box} bg-orange-950 border-orange-500 text-orange-100`
  const label = 'text-sm font-semibold'
  const sublabel = 'text-xs text-gray-400 mt-0.5'
  const arrow = 'text-gray-500 text-xl font-bold mx-1 self-center'
  const group = 'flex flex-col gap-2 rounded-xl border border-dashed p-3'

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start gap-2 min-w-max text-sm">

        {/* WSL2 group — only Terraform, Prowler, ingest, Docker */}
        <div className={`${group} border-gray-600`}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 text-center">WSL2</p>
          <div className="flex flex-col gap-2">
            <div className={primary}>
              <span className={label}>Terraform</span>
              <span className={sublabel}>before / after .tfvars</span>
            </div>
            <div className={primary}>
              <span className={label}>Prowler</span>
              <span className={sublabel}>5 checks × 3 providers</span>
            </div>
            <div className={primary}>
              <span className={label}>ingest_prowler.py</span>
              <span className={sublabel}>normalise → findings.json</span>
            </div>
            <div className={primary}>
              <span className={label}>Docker build</span>
              <span className={sublabel}>JSON baked into image</span>
            </div>
          </div>
        </div>

        <span className={arrow}>↔</span>

        {/* Cloud Accounts — outside WSL2 */}
        <div className={`${group} border-gray-600`}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 text-center">Cloud Accounts</p>
          <div className="flex flex-col gap-2">
            <div className={cloud}><span className={label}>AWS</span></div>
            <div className={cloud}><span className={label}>GCP</span></div>
            <div className={cloud}><span className={label}>Azure</span></div>
          </div>
        </div>

        <span className={arrow}>→</span>

        {/* GCP Infrastructure — Secret Manager, Artifact Registry, Cloud Run */}
        <div className={`${group} border-indigo-800`}>
          <p className="text-xs text-indigo-500 uppercase tracking-widest mb-1 text-center">GCP Infrastructure</p>
          <div className="flex flex-col gap-2">
            <div className={infra}>
              <span className={label}>Secret Manager</span>
              <span className={sublabel}>credentials at runtime</span>
            </div>
            <div className={infra}>
              <span className={label}>Artifact Registry</span>
            </div>
            <div className={infra}>
              <span className={label}>Cloud Run</span>
              <span className={sublabel}>React dashboard</span>
            </div>
          </div>
        </div>

        <span className={arrow}>→</span>

        {/* Edge */}
        <div className={edge}>
          <span className={label}>Cloudflare</span>
          <span className={sublabel}>CDN · WAF · DDoS</span>
          <span className="text-xs text-orange-300 mt-1">prowler.cloudsecuritypractice.com</span>
        </div>

        <span className={arrow}>→</span>

        {/* Reviewer */}
        <div className={`${box} bg-green-950 border-green-500 text-green-100`}>
          <span className="text-2xl mb-1">👤</span>
          <span className={label}>Reviewer</span>
        </div>

      </div>
    </div>
  )
}
