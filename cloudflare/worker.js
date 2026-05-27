function blocked(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return blocked(405, 'Method Not Allowed')
    }

    const url = new URL(request.url);
    url.hostname = env.CLOUD_RUN_HOST;
    const modified = new Request(url.toString(), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'X-CF-Secret': env.CF_SECRET,
      },
      body: request.body,
    });
    return fetch(modified)
  },
}
