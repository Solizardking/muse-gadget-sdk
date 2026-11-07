// Keep the public wallet origin while Railway serves the application and API.
const PUBLIC_HOST = 'wallet.musebook.trade';

function unavailable(status = 503) {
  return new Response('Pocket Wallet is temporarily unavailable.', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const publicUrl = new URL(request.url);
    if (publicUrl.hostname !== PUBLIC_HOST) return new Response('Not found', { status: 404 });
    if (publicUrl.protocol !== 'https:') {
      publicUrl.protocol = 'https:';
      return Response.redirect(publicUrl.href, 308);
    }

    let upstream;
    try {
      upstream = new URL(env.RAILWAY_ORIGIN);
      if (upstream.protocol !== 'https:' || !upstream.hostname.endsWith('.up.railway.app') ||
          upstream.username || upstream.password || upstream.port ||
          upstream.pathname !== '/' || upstream.search || upstream.hash || !env.EDGE_PROXY_SECRET) {
        return unavailable();
      }
    } catch {
      return unavailable();
    }

    // Assign the path separately: a leading // must never replace the upstream host.
    const targetUrl = new URL(upstream.href);
    targetUrl.pathname = publicUrl.pathname;
    targetUrl.search = publicUrl.search;
    if (targetUrl.origin !== upstream.origin) return unavailable();
    const headers = new Headers(request.headers);
    // Cloudflare supplies CF-Connecting-IP. Never pass caller-supplied trust headers.
    const clientIp = headers.get('CF-Connecting-IP');
    headers.delete('x-pocket-client-ip');
    headers.delete('x-pocket-edge-token');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-IPCountry');
    headers.delete('Forwarded');
    headers.delete('X-Forwarded-For');
    headers.set('Host', upstream.host);
    headers.set('X-Forwarded-Host', PUBLIC_HOST);
    headers.set('X-Forwarded-Proto', 'https');
    headers.set('x-pocket-edge-token', env.EDGE_PROXY_SECRET);
    if (clientIp) headers.set('x-pocket-client-ip', clientIp);

    let response;
    try {
      response = await fetch(targetUrl.href, {
        method: request.method,
        headers,
        redirect: 'manual',
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        cache: 'no-store',
        cf: { cacheTtlByStatus: { '100-599': -1 } },
      });
    } catch {
      return unavailable(502);
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('x-pocket-edge-token');
    responseHeaders.delete('x-pocket-client-ip');
    const location = responseHeaders.get('Location');
    if (location) {
      try {
        const redirect = new URL(location, targetUrl);
        if (redirect.origin === upstream.origin) {
          redirect.host = publicUrl.host;
          responseHeaders.set('Location', redirect.href);
        }
      } catch { /* Preserve unrelated or invalid redirect values. */ }
    }
    if (publicUrl.pathname === '/healthz' || publicUrl.pathname.startsWith('/api/') ||
        responseHeaders.get('Content-Type')?.includes('text/html')) {
      responseHeaders.set('Cache-Control', 'no-store');
    }
    // Stream inference events and file bytes without collecting the body.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
