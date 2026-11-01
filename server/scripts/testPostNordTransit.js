require('dotenv').config()

async function testPostNordTransit() {
  const url = new URL(
  '/v2/transittime/addresstoaddress',
  process.env.POSTNORD_BASE_URL
)

  // PostNord förväntar sig svensk lokal tid utan tidszonsuffix.
  const startTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()).replace(' ', 'T')

  const params = {
    apikey: process.env.POSTNORD_API_KEY,
    startTime,
    serviceGroup: 'SE',
    serviceCodes: '19',
    originStreetName: 'Teststreet',
    originStreetNumber: '1',
    originPostCode: process.env.POSTNORD_ORIGIN_POSTCODE,
    originCountryCode: 'SE',
    destinationStreetName: 'Sveavägen',
    destinationStreetNumber: '1',
    destinationPostCode: '11157',
    destinationCountryCode: 'SE',
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  })

  const rawText = await response.text()

  console.log('HTTP-status:', response.status)

  let data

  try {
    data = JSON.parse(rawText)
  } catch {
    console.log('PostNord returnerade inte JSON.')
    console.log('Svar:', rawText.slice(0, 300))
    return
  }

  console.log('Response keys:', Object.keys(data))
  console.log('Svar:', JSON.stringify(data, null, 2).slice(0, 2500))
}

testPostNordTransit().catch((error) => {
  console.error('Transit test failed:', error.message)
})
