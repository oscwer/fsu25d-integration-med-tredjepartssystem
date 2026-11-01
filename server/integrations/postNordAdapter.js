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

module.exports = {
  getNearestServicePoints,
}
