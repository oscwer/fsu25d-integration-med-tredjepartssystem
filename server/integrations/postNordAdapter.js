const { z } = require('zod')

const servicePointSchema = z.object({
  servicePointId: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  visitingAddress: z.object({
    streetName: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().optional(),
  }).optional(),
  routeDistance: z.number().optional(),
})

const postNordResponseSchema = z.object({
  servicePointInformationResponse: z.object({
    servicePoints: z.array(servicePointSchema),
  }),
})

async function getNearestServicePoints(postalCode) {
  const url = new URL(
    '/rest/businesslocation/v5/servicepoints/nearest/byaddress',
    process.env.POSTNORD_BASE_URL
  )

  url.searchParams.set('apikey', process.env.POSTNORD_API_KEY)
  url.searchParams.set('returnType', 'json')
  url.searchParams.set('countryCode', 'SE')
  url.searchParams.set('postalCode', postalCode)
  url.searchParams.set('numberOfServicePoints', '5')
  url.searchParams.set('responseFilter', 'public')

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`PostNord returned HTTP ${response.status}`)
  }

  const rawData = await response.json()
  const parsed = postNordResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    throw new Error('Invalid PostNord response structure')
  }

  return parsed.data.servicePointInformationResponse.servicePoints.map(
    (point) => ({
      id: String(point.servicePointId),
      name: point.name,
      address: point.visitingAddress?.streetName ?? '',
      city: point.visitingAddress?.city ?? '',
      postalCode: point.visitingAddress?.postalCode ?? '',
      countryCode: point.visitingAddress?.countryCode ?? 'SE',
      distance: point.routeDistance ?? null,
    })
  )
}

function getNextDispatchTime() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const today = formatter.format(new Date())
  const date = new Date(`${today}T12:00:00Z`)

  // Börja med nästa kalenderdag.
  date.setUTCDate(date.getUTCDate() + 1)

  // Hoppa över lördag och söndag.
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1)
  }

  const dateString = date.toISOString().slice(0, 10)

  return `${dateString}T12:00:00`
}

const transitTimeResponseSchema = z.array(
  z.object({
    isBookable: z.boolean(),
    isSupported: z.boolean(),

    service: z.object({
      basicServiceCode: z.string(),
      name: z.string(),
      additionalServices: z.array(
        z.object({
          additionalServiceCode: z.string(),
        })
      ).optional(),
    }),

    estimatedTimeOfArrival: z.object({
      dateOfDeparture: z.string(),
      timeOfArrival: z.string(),
    }).optional(),
  })
)

async function getTransitTime(postalCode) {
  const url = new URL(
    '/rest/transport/v2/transittime/addresstoaddress',
    process.env.POSTNORD_BASE_URL
  )

  // Första versionen använder ett fast testdatum.
  // Vi ersätter det med dynamisk avsändningstid senare.
  const params = {
    apikey: process.env.POSTNORD_API_KEY,
    startTime: getNextDispatchTime(),
    serviceGroup: 'SE',
    serviceCodes: '19',
    originPostCode: process.env.POSTNORD_ORIGIN_POSTCODE,
    originCountryCode: 'SE',
    destinationPostCode: postalCode,
    destinationCountryCode: 'SE',
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(
      `PostNord Transit Time returned HTTP ${response.status}`
    )
  }

  const rawData = await response.json()
  const parsed = transitTimeResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    throw new Error('Invalid PostNord Transit Time response structure')
  }

  const data = parsed.data

  // Välj ordinarie ombudsleverans, utan tilläggstjänster.
  const option = data.find((item) =>
    item.isBookable === true &&
    item.isSupported === true &&
    item.service?.basicServiceCode === '19' &&
    !item.service?.additionalServices?.length &&
    item.estimatedTimeOfArrival?.timeOfArrival
  )

  if (!option) {
    throw new Error('No available PostNord delivery estimate')
  }

  return {
    estimatedDelivery: option.estimatedTimeOfArrival.timeOfArrival,
    estimatedDispatch: option.estimatedTimeOfArrival.dateOfDeparture,
    serviceName: option.service.name,
  }
}

module.exports = {
  getNearestServicePoints,
  getTransitTime,
}
