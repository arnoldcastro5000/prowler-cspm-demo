export default {
  async fetch(request, env) {
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
