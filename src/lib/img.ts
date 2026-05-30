// Guest entries can carry an arbitrary remote image URL (and profile avatars
// come from arbitrary hosts too). Most of those hosts don't send the
// `Access-Control-Allow-Origin` header, so loading them with `crossOrigin`
// (which we must, to draw them into the WebGL wall texture) fails outright.
//
// We route remote images through the wsrv.nl image proxy, which re-serves them
// with CORS headers (and can resize on the way), so they render reliably both
// on the zoomed-out canvas and in the crisp DOM cards. Local assets, data:/blob:
// URIs, and already-proxied URLs pass through untouched.

const PROXY_ORIGINS = ["https://wsrv.nl", "https://images.weserv.nl"];

/**
 * Wrap a remote image URL in the wsrv.nl CORS proxy. Returns the input
 * unchanged for anything we can't or shouldn't proxy (data/blob URIs, relative
 * app assets, non-http URLs, or already-proxied URLs).
 *
 * @param width  Optional target width (CSS px); the proxy resizes (preserving
 *               aspect) and serves at 2x for crispness, trimming bandwidth.
 */
export function proxyImage(url: string, width?: number): string {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/") ||
    !/^https?:\/\//i.test(url) ||
    PROXY_ORIGINS.some((o) => url.startsWith(o))
  ) {
    return url;
  }

  const params = new URLSearchParams({ url });
  if (width && width > 0) {
    params.set("w", String(Math.round(width)));
    params.set("dpr", "2");
  }
  return `https://wsrv.nl/?${params.toString()}`;
}
