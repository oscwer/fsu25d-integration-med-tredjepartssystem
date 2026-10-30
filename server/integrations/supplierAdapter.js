const { parse } = require('csv-parse/sync')
const { XMLParser } = require('fast-xml-parser')
const { z } = require('zod')

async function fetchSupplierCsv() {
  const url = new URL(
    `${process.env.SUPPLIER_API_URL}/export/products.csv`
  )

  url.searchParams.set(
    'bransch',
    process.env.SUPPLIER_INDUSTRY
  )

  const response = await fetch(url, {
    headers: {
      'X-Api-Key': process.env.SUPPLIER_API_KEY,
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`Supplier API returned ${response.status}`)
  }

  const buffer = await response.arrayBuffer()

  const decoder = new TextDecoder('iso-8859-1')

  return decoder.decode(buffer)
}

async function fetchSupplierXml() {
  const url = new URL(
    `${process.env.SUPPLIER_API_URL}/export/products.xml`
  )

  url.searchParams.set(
    'bransch',
    process.env.SUPPLIER_INDUSTRY
  )

  const response = await fetch(url, {
    headers: {
      'X-Api-Key': process.env.SUPPLIER_API_KEY,
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`Supplier API returned ${response.status}`)
  }

  return response.text()
}

function parseSupplierXml(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
  })

  return parser.parse(xmlText)
}

function mapXmlToSupplierProducts(xmlData) {
  const products = xmlData.katalog.produkt

  return products.map((product) => ({
    artNr: product['@_artNr'],
    ean: product.ean,
    benamning: product.benamning,
    kategori: product.kategori,
    pris: product.pris['#text'],
    lagersaldo: product.lagersaldo ?? '',
    varianter: product.varianter?.variant
      ? [product.varianter.variant].flat().join('|')
      : '',
    uppdaterad: product.uppdaterad,
  }))
}

function parseSupplierCsv(csvText) {
  return parse(csvText, {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    bom: true,
  })
}

const ProductSchema = z.object({
  article_number: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().finite().nonnegative(),
  ean: z.string(),
  variants: z.array(z.string()),
  stock: z.number().int().nonnegative().nullable(),
})

function normalizeSupplierProduct(product) {
  const price = Number(product.pris.replace(',', '.'))

  const variants = product.varianter
    ? product.varianter.split('|')
    : []

  const stock = product.lagersaldo === ''
    ? null
    : Number(product.lagersaldo)

  return {
    article_number: product.artNr,
    name: product.benamning,
    description: `Kategori: ${product.kategori}`,
    price,
    ean: product.ean,
    variants,
    stock,
  }
}

function validateSupplierProducts(products) {
  const valid = []
  const skipped = []

  for (const product of products) {
    const normalized = normalizeSupplierProduct(product)
    const result = ProductSchema.safeParse(normalized)

    if (result.success) {
      valid.push(result.data)
    } else {
      skipped.push({
        article_number: product.artNr,
        reason: result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      })
    }
  }

  return { valid, skipped }
}

module.exports = {
  fetchSupplierCsv,
  parseSupplierCsv,
  normalizeSupplierProduct,
  validateSupplierProducts,
  fetchSupplierXml,
  parseSupplierXml,
  mapXmlToSupplierProducts
}