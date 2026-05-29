// Source: dashboard/src/main.tsx (routes) | dashboard/public/ (static files)
const VALID_PATHS = new Set([
  '/', '/before', '/after', '/security', '/threat-model', '/architecture',
  '/owasp-top-10', '/owasp-cicd', '/owasp-llm', '/owasp-genai',
  '/findings_before.json', '/findings_after.json',
  '/prowler-cspm-pipeline.png', '/og-image.png',
  '/favicon.svg', '/robots.txt', '/sitemap.xml',
  '/google2f6ba5fa8c90cf5f.html',
])

const ASSETS_PATTERN = /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_]+\.(js|css)$/

function blocked(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request, env) {
    // 0. Redirect root domain to canonical subdomain
    const reqHost = (request.headers.get('host') || '').toLowerCase()
    if (reqHost === env.ROOT_DOMAIN || reqHost === env.ROOT_DOMAIN + ':443') {
      const redirectUrl = new URL(request.url)
      redirectUrl.hostname = env.EXPECTED_HOST
      return Response.redirect(redirectUrl.toString(), 301)
    }

    // 1. Allow OPTIONS, block all other non-GET/HEAD methods
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return blocked(405, 'Method Not Allowed')
    }

    // 2. Block request bodies
    if (request.body !== null) {
      return blocked(400, 'Bad Request')
    }

    // 3. Block encoded traversal and null bytes (inspect raw URL before parsing)
    if (/%2e%2e|%252e|%2f|%00|%5c/i.test(request.url) || request.url.includes('\\')) {
      return blocked(400, 'Bad Request')
    }

    const url = new URL(request.url)

    // 4. URL length limit
    if (url.pathname.length > 256) {
      return blocked(414, 'URI Too Long')
    }

    // 5. Path allowlist (ASSETS_PATTERN restricts /assets/ to .js and .css)
    if (!VALID_PATHS.has(url.pathname) && !ASSETS_PATTERN.test(url.pathname)) {
      return blocked(404, 'Not Found')
    }

    // 6. Block oversized headers
    let totalHeaderSize = 0
    for (const [name, value] of request.headers) {
      if (name.length + value.length > 4096) {
        return blocked(431, 'Request Header Fields Too Large')
      }
      totalHeaderSize += name.length + value.length
    }
    if (totalHeaderSize > 16384) {
      return blocked(431, 'Request Header Fields Too Large')
    }

    // 7. Validate Host header
    const host = (request.headers.get('host') || '').toLowerCase()
    if (host !== env.EXPECTED_HOST && host !== env.EXPECTED_HOST + ':443') {
      return blocked(421, 'Misdirected Request')
    }

    // Proxy to origin
    url.hostname = env.CLOUD_RUN_HOST
    const modified = new Request(url.toString(), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'X-CF-Secret': env.CF_SECRET,
      },
    })
    try {
      return await fetch(modified)
    } catch {
      return blocked(502, 'Bad Gateway')
    }
  },
}
