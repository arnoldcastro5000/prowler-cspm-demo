// Valid routes and static files — update when dashboard changes
// Routes: dashboard/src/main.tsx | Static files: dashboard/public/
const VALID_PATHS = new Set([
  '/', '/before', '/after', '/security', '/threat-model', '/architecture',
  '/findings_before.json', '/findings_after.json',
  '/prowler-cspm-pipeline.png', '/og-image.png',
  '/favicon.svg', '/robots.txt', '/sitemap.xml',
])

const ASSETS_PATTERN = /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9]+\.(js|css)$/

const MAX_URL_LENGTH =  256
const MAX_TOTAL_HEADERS = 8192
const MAX_SINGLE_HEADER = 2048

function blocked(status, message) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    },
  })
}

export default {
  async fetch(request, env) {
    // Rule 1: Block non-GET/HEAD methods
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return blocked(405, 'Method Not Allowed')
    }

    // Rule 2: Block request bodies
    if (request.body !== null) {
      return blocked(400, 'Bad Request')
    }

    // Rule 6: Block encoded traversal and null bytes (inspect raw URL before parsing)
    const rawUrl = request.url
    if (/%2e%2e|%252e|%2f|%00|%5c/i.test(rawUrl) || rawUrl.includes('\\')) {
      return blocked(400, 'Bad Request')
    }

    const url = new URL(request.url)

    // Rule 5: URL length limit
    if (url.pathname.length > MAX_URL_LENGTH) {
      return blocked(414, 'URI Too Long')
    }

    // Rule 4: Block query strings
    if (url.search !== '') {
      return blocked(400, 'Bad Request')
    }

    // Rule 3: Path allowlist
    if (!VALID_PATHS.has(url.pathname) && !ASSETS_PATTERN.test(url.pathname)) {
      return blocked(404, 'Not Found')
    }

    // Rule 7: Restrict /assets/ to valid extensions (covered by ASSETS_PATTERN in Rule 3)

    // Rule 8: Block oversized headers
    let totalHeaderSize = 0
    for (const [name, value] of request.headers) {
      const entrySize = name.length + value.length
      if (entrySize > MAX_SINGLE_HEADER) {
        return blocked(431, 'Request Header Fields Too Large')
      }
      totalHeaderSize += entrySize
    }
    if (totalHeaderSize > MAX_TOTAL_HEADERS) {
      return blocked(431, 'Request Header Fields Too Large')
    }

    // Rule 9: Validate Host header
    const host = request.headers.get('host')
    if (host && host !== env.EXPECTED_HOST) {
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
  }
}
