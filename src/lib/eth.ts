export type EthDecimal = string

const weiPerEth = 10n ** 18n
const basisPointsPerWhole = 10_000

export function parseEth(amount: EthDecimal): bigint {
  if (typeof amount !== 'string' || !/^\d+(?:\.\d{1,18})?$/.test(amount)) {
    throw new RangeError('Valor em ETH inválido')
  }

  const [whole, fraction = ''] = amount.split('.')
  return BigInt(whole) * weiPerEth + BigInt(fraction.padEnd(18, '0'))
}

export function formatEth(wei: bigint): EthDecimal {
  if (wei < 0n) throw new RangeError('Valor em wei inválido')

  const whole = wei / weiPerEth
  const fraction = (wei % weiPerEth).toString().padStart(18, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

export function displayEth(amount: EthDecimal) {
  return displayAmount(amount, 'ETH')
}

export function displayAmount(amount: string, currency: string) {
  return `${amount.replace('.', ',')} ${currency}`
}

export function calculateEthTotals(
  lines: readonly { priceEth: EthDecimal; quantity: number }[],
  discountBps: number,
  networkFeeEth: EthDecimal,
) {
  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > basisPointsPerWhole) {
    throw new RangeError('Desconto inválido')
  }

  const subtotal = lines.reduce((sum, { priceEth, quantity }) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError('Quantidade inválida')
    return sum + parseEth(priceEth) * BigInt(quantity)
  }, 0n)
  const discount = subtotal * BigInt(discountBps) / BigInt(basisPointsPerWhole)
  const fee = parseEth(networkFeeEth)

  return {
    subtotalEth: formatEth(subtotal),
    discountEth: formatEth(discount),
    networkFeeEth: formatEth(fee),
    totalEth: formatEth(subtotal - discount + fee),
  }
}
