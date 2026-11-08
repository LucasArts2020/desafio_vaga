export function safeReturnTo(input: unknown) {
  if (typeof input !== 'string' || !input.startsWith('/') || input.startsWith('//') || input.includes('\\')) {
    return '/'
  }
  const url = new URL(input, window.location.origin)
  const allowed = ['/', '/carrinho', '/checkout', '/opensea'].includes(url.pathname)
    || /^\/nfts\/[a-z\d-]+$/.test(url.pathname)
    || /^\/opensea\/0x[\da-f]{40}\/\d{1,78}$/i.test(url.pathname)
  return allowed && url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/'
}

export function validateAuthSearch(search: Record<string, unknown>): { returnTo?: string; expired?: boolean } {
  return {
    returnTo: search.returnTo ? safeReturnTo(search.returnTo) : undefined,
    expired: search.expired === true ? true : undefined,
  }
}
