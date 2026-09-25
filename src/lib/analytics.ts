// Thin wrapper around the `gtag` global set up in index.html — reads it
// off `window` at call time rather than importing it, since it's loaded by
// a plain <script> tag, not a module. No-ops silently if it's missing
// (blocked by an ad blocker, or the dev/localhost build, which never calls
// `gtag('config', ...)` in the first place).
type Gtag = (...args: unknown[]) => void

export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag
  if (typeof gtag === 'function') gtag('event', name, params)
}
