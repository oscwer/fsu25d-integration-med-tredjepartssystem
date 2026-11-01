require('dotenv').config()

async function testPostNord() {
  const url = new URL(
    '/rest/businesslocation/v5/servicepoints/nearest/byaddress',
    process.env.POSTNORD_BASE_URL
  )

  url.searchParams.set('apikey', process.env.POSTNORD_API_KEY)
  url.searchParams.set('returnType', 'json')
  url.searchParams.set('countryCode', 'SE')
  url.searchParams.set('postalCode', '11122')
  url.searchParams.set('numberOfServicePoints', '5')
  url.searchParams.set('responseFilter', 'public')

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  })

  const data = await response.json()

  console.log('HTTP-status:', response.status)

  // Visa endast strukturen, inte hela svaret.
  console.log('Response keys:', Object.keys(data))

  if (!response.ok) {
    console.log('PostNord API returned an error')
    return
  }

  console.log('API-anropet lyckades!')

  const servicePoints =
    data.servicePointInformationResponse?.servicePoints

    if (!Array.isArray(servicePoints)) {
    throw new Error('PostNord returned an unexpected response structure')
    }

    console.log('Antal ombud:', servicePoints.length)

    console.log(
    'Ombud:',
    servicePoints.map((point) => ({
        id: point.servicePointId,
        name: point.name,
        address: point.visitingAddress?.streetName,
        city: point.visitingAddress?.city,
        postalCode: point.visitingAddress?.postalCode,
        countryCode: point.visitingAddress?.countryCode,
        distance: point.routeDistance,
    }))
    )
}

testPostNord().catch((error) => {
  console.error('PostNord test failed:', error.message)
})