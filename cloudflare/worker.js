// Source: dashboard/src/main.tsx (routes) | dashboard/public/ (static files)
const VALID_PATHS = new Set([
  '/', '/before', '/after', '/security', '/threat-model', '/architecture',
  '/findings_before.json', '/findings_after.json',
  '/prowler-cspm-pipeline.png', '/og-image.png',
  '/favicon.svg', '/robots.txt', '/sitemap.xml',
])

const ASSETS_PATTERN = /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9]+\.(js|css)$/

function blocked(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request, env) {
    // Rule 1: Allow OPTIONS, block all other non-GET/HEAD methods
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return blocked(405, 'Method Not Allowed')
    }

    // Rule 2: Block request bodies
    if (request.body !== null) {
      return blocked(400, 'Bad Request')
    }

    const url = new URL(request.url)

    // Rule 3: Path allowlist
    if (!VALID_PATHS.has(url.pathname) && !ASSETS_PATTERN.test(url.pathname)) {
      return blocked(404, 'Not Found')
    }

    url.hostname = env.CLOUD_RUN_HOST
    const modified = new Request(url.toString(), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'X-CF-Secret': env.CF_SECRET,
      },
    })
    return fetch(modified)
  },
}
