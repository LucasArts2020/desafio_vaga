const coupons = new Map([
  ['ACERVO5', { discountBps: 500, expiresAt: Number.POSITIVE_INFINITY }],
  ['EXPIRADO', { discountBps: 500, expiresAt: Date.UTC(2020, 0, 1) }],
])

export function readCoupon(code: string, now: number) {
  const coupon = coupons.get(code)
  if (!coupon) {
    return { issue: { code: 'COUPON_INVALID', message: 'Cupom inválido.' } } as const
  }
  if (coupon.expiresAt <= now) {
    return { issue: { code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' } } as const
  }
  return { discountBps: coupon.discountBps }
}
