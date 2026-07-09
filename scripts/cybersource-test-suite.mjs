// scripts/cybersource-test-suite.mjs
// Suite de pruebas contra CyberSource TEST (apitest.cybersource.com)
// basada en https://developer.cybersource.com/hello-world/testing-guide-v1.html
//
// Uso:
//   CYBERSOURCE_KEY_ID=xxx CYBERSOURCE_SHARED_SECRET='yyy' node scripts/cybersource-test-suite.mjs
//
// Opcional: CYBERSOURCE_MERCHANT_ID (default: visanetgt_rehabimovement)
// Requiere Node 18+. No usar NUNCA contra api.cybersource.com (producción).

import crypto from 'node:crypto'

const HOST = 'apitest.cybersource.com'
const MERCHANT_ID = process.env.CYBERSOURCE_MERCHANT_ID || 'visanetgt_rehabimovement'
const KEY_ID = process.env.CYBERSOURCE_KEY_ID
const SHARED_SECRET = process.env.CYBERSOURCE_SHARED_SECRET

if (!KEY_ID || !SHARED_SECRET) {
  console.error('Faltan CYBERSOURCE_KEY_ID / CYBERSOURCE_SHARED_SECRET en el entorno')
  process.exit(1)
}

// --- Firma HTTP Signature -------------------------------------------------

function signedHeaders(resource, body) {
  const date = new Date().toUTCString()
  const digest = 'SHA-256=' + crypto.createHash('sha256').update(body).digest('base64')
  const signingString = [
    `host: ${HOST}`,
    `date: ${date}`,
    `request-target: post ${resource}`,
    `digest: ${digest}`,
    `v-c-merchant-id: ${MERCHANT_ID}`,
  ].join('\n')
  const signature = crypto
    .createHmac('sha256', Buffer.from(SHARED_SECRET, 'base64'))
    .update(signingString)
    .digest('base64')
  return {
    'Content-Type': 'application/json',
    'v-c-merchant-id': MERCHANT_ID,
    Date: date,
    Host: HOST,
    Digest: digest,
    Signature: `keyid="${KEY_ID}", algorithm="HmacSHA256", headers="host date request-target digest v-c-merchant-id", signature="${signature}"`,
  }
}

async function pay({ amount = '1.00', card, month = '12', year = '2030', cvv = '123', ref }) {
  const body = JSON.stringify({
    clientReferenceInformation: { code: ref },
    processingInformation: { capture: true, commerceIndicator: 'internet' },
    paymentInformation: {
      card: { number: card, expirationMonth: month, expirationYear: year, securityCode: cvv },
    },
    orderInformation: {
      amountDetails: { totalAmount: String(amount), currency: 'GTQ' },
      billTo: {
        firstName: 'Miguel', lastName: 'Cabrera',
        address1: 'Ciudad de Guatemala', locality: 'Guatemala',
        administrativeArea: 'GT', postalCode: '01001', country: 'GT',
        email: 'mecg1994@gmail.com', phoneNumber: '33127828',
      },
    },
  })
  const res = await fetch(`https://${HOST}/pts/v2/payments`, {
    method: 'POST',
    headers: signedHeaders('/pts/v2/payments', body),
    body,
  })
  const json = await res.json().catch(() => ({}))
  return { http: res.status, status: json.status ?? '—', reason: json.reason ?? json.errorInformation?.reason ?? '', id: json.id ?? '', msg: json.message ?? json.errorInformation?.message ?? '' }
}

// --- Casos de prueba --------------------------------------------------------

const cardBrands = [
  ['Visa 4111...1111',            { card: '4111111111111111' }],
  ['Visa 4622...3705',            { card: '4622943127013705', cvv: '838' }],
  ['Visa 4622...3713',            { card: '4622943127013713', cvv: '043' }],
  ['Visa 4622...3721',            { card: '4622943127013721', cvv: '258' }],
  ['Visa 4622...3739',            { card: '4622943127013739', cvv: '942' }],
  ['Visa 4622...3747',            { card: '4622943127013747', cvv: '370' }],
  ['Mastercard 2222...1113',      { card: '2222420000001113' }],
  ['Mastercard 2222...1125',      { card: '2222630000001125' }],
  ['Mastercard 5555...4444',      { card: '5555555555554444' }],
  ['Amex 3782...0005',            { card: '378282246310005', cvv: '1234' }],
  ['Discover 6011...1117',        { card: '6011111111111117' }],
  ['JCB 3566...1113',             { card: '3566111111111113' }],
  ['Maestro Intl 5033...17',      { card: '503396198909 17'.replace(/\s/g, '') }],
  ['Maestro Intl 5868...38',      { card: '5868241608255333 38'.replace(/\s/g, '') }],
  ['Maestro UK 6759...0008',      { card: '6759411100000008' }],
  ['Maestro UK 6759...054',       { card: '6759560045005727054' }],
  ['Maestro UK 5641...6669',      { card: '5641821111166669' }],
  ['UATP 1354...911',             { card: '135412345678911' }],
]

const triggers = [
  ['Valid transaction (amount=1)',   { card: '4111111111111111', amount: '1' },            'AUTHORIZED'],
  ['Invalid amount < 0 (-1)',        { card: '4111111111111111', amount: '-1' },           'INVALID_REQUEST'],
  ['Amount too large (1e11)',        { card: '4111111111111111', amount: '100000000000' }, 'INVALID_REQUEST'],
  ['Bad card 42423482938483873',     { card: '42423482938483873' },                        'DECLINE/INVALID_REQUEST'],
  ['Invalid expiration month (13)',  { card: '4111111111111111', month: '13' },            'INVALID_REQUEST'],
  ['Invalid expiration year (1998)', { card: '4111111111111111', year: '1998' },           'DECLINE/INVALID_REQUEST'],
  ['Invalid Luhn (…1112)',           { card: '4111111111111112' },                         'DECLINE/INVALID_REQUEST'],
  ['21-digit card number',           { card: '412345678912345678914' },                    'DECLINE/INVALID_REQUEST'],
]

// --- Ejecución ---------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n)
let seq = Date.now()

console.log(`\nCyberSource TEST suite — merchant: ${MERCHANT_ID}\n`)

console.log('== TARJETAS POR MARCA (monto 1.00 GTQ) ==')
console.log(pad('Caso', 28) + pad('HTTP', 6) + pad('STATUS', 22) + pad('REASON', 24) + 'ID')
for (const [name, params] of cardBrands) {
  const r = await pay({ ...params, ref: `SUITE-CARD-${seq++}` })
  console.log(pad(name, 28) + pad(r.http, 6) + pad(r.status, 22) + pad(r.reason, 24) + r.id)
}

console.log('\n== TRIGGERS DE RESPUESTA ==')
console.log(pad('Caso', 34) + pad('HTTP', 6) + pad('STATUS', 22) + pad('Esperado', 26) + 'OK')
for (const [name, params, expected] of triggers) {
  const r = await pay({ ...params, ref: `SUITE-TRIG-${seq++}` })
  const ok = expected.split('/').some((e) => r.status === e || r.reason === 'INVALID_DATA' && e.includes(r.status))
  console.log(pad(name, 34) + pad(r.http, 6) + pad(r.status, 22) + pad(expected, 26) + (ok ? '✅' : `❌ (${r.reason} ${r.msg})`))
}

console.log('\nRevisa las transacciones en https://ebc2test.cybersource.com → Transaction Management → Transactions\n')
