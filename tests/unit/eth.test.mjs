import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateEthTotals, formatEth, parseEth } from '../../src/lib/eth.ts'

test('preserva até um wei em valores pequenos e maiores que Number.MAX_SAFE_INTEGER', () => {
  assert.equal(parseEth('0.000000000000000001'), 1n)
  assert.equal(formatEth(1n), '0.000000000000000001')
  const amount = '9007199254740993.000000000000000001'
  assert.equal(formatEth(parseEth(amount)), amount)
  assert.equal(formatEth(parseEth('000.12000')), '0.12')
  assert.equal(formatEth(0n), '0')
})

test('rejeita ETH fora do contrato e valores negativos em wei', () => {
  for (const invalid of ['', '1,2', '1e3', ' 1', '1\n', '-1', '+1', '1.', '0.0000000000000000001', 1]) {
    assert.throws(() => parseEth(invalid), RangeError)
  }
  assert.throws(() => formatEth(-1n), RangeError)
})

test('calcula subtotal, desconto e taxa em wei e arredonda o desconto para baixo', () => {
  assert.deepEqual(calculateEthTotals(
    [{ priceEth: '0.1', quantity: 3 }, { priceEth: '0.000000000000000001', quantity: 1 }],
    500,
    '0.000000000000000002',
  ), {
    subtotalEth: '0.300000000000000001',
    discountEth: '0.015',
    networkFeeEth: '0.000000000000000002',
    totalEth: '0.285000000000000003',
  })
})

test('rejeita quantidades não inteiras e desconto fora do intervalo', () => {
  for (const quantity of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateEthTotals([{ priceEth: '1', quantity }], 0, '0'), RangeError)
  }
  for (const discount of [-1, 0.5, 10_001]) {
    assert.throws(() => calculateEthTotals([], discount, '0'), RangeError)
  }
})
