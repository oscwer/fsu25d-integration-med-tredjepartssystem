const express = require('express')
const cors = require('cors')
const supabase = require('./supabase')
const { getExchangeRates } = require('./integrations/currencyAdapter')
const {
  fetchSupplierCsv,
  parseSupplierCsv,
  fetchSupplierXml,
  parseSupplierXml,
  mapXmlToSupplierProducts,
  validateSupplierProducts,
} = require('./integrations/supplierAdapter')

const {
  upsertProducts,
} = require('./services/productImportService')

const { z } = require('zod')
const {
  searchProducts,
  indexProducts,
} = require('./integrations/algoliaAdapter')

async function importSupplierProducts(format) {
  let products

  if (format === 'csv') {
    const csv = await fetchSupplierCsv()
    products = parseSupplierCsv(csv)
  } else if (format === 'xml') {
    const xml = await fetchSupplierXml()
    const parsed = parseSupplierXml(xml)
    products = mapXmlToSupplierProducts(parsed)
  } else {
    throw new Error('Unsupported import format')
  }

  const { valid, skipped } = validateSupplierProducts(products)

  const { created, updated } = await upsertProducts(valid)

  // Hämta produkterna med deras databas-ID
  const articleNumbers = valid.map(
    (product) => product.article_number
  )

  const { data: savedProducts, error: dbError } = await supabase
    .from('products')
    .select('id, article_number, name, description, price')
    .in('article_number', articleNumbers)

  let searchSynced = false

  if (dbError) {
    console.error('Could not load products for Algolia:', dbError.message)
  } else {
    try {
      await indexProducts(savedProducts)
      searchSynced = true
    } catch (error) {
      console.error('Algolia import sync failed:', error.message)
    }
  }

  return {
    format,
    total: products.length,
    created,
    updated,
    skipped: skipped.length,
    skippedProducts: skipped,
    searchSynced,
  }
}

async function syncProductToAlgolia(product) {
  try {
    await indexProducts([product])
    return true
  } catch (error) {
    console.error('Algolia synchronization failed:', error.message)
    return false
  }
}

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/currencies', async (req, res) => {
  try {
    const data = await getExchangeRates()

    res.json(data)
  } catch (error) {
    console.error('Currency API error:', error)

    res.status(500).json({
      error: 'Failed to fetch exchange rates',
    })
  }
})

app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) {
    console.error('Database error:', error)
    return res.status(500).json({ error: 'Failed to fetch products' })
  }

  res.json(data)
})

app.post('/api/products', async (req, res) => {
  const { name, description, price } = req.body

  if (!name || price === undefined) {
    return res.status(400).json({
      error: 'Name and price are required',
    })
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      description,
      price,
    })
    .select()
    .single()

  if (error) {
    console.error('Database error:', error)
    return res.status(500).json({
      error: 'Failed to create product',
    })
  }

  const searchSynced = await syncProductToAlgolia(data)

  res.status(201).json({
    ...data,
    searchSynced,
  })
})

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params
  const { name, description, price } = req.body

  if (!name || price === undefined) {
    return res.status(400).json({
      error: 'Name and price are required',
    })
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      name,
      description,
      price,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Database error:', error)
    return res.status(500).json({
      error: 'Failed to update product',
    })
  }
const searchSynced = await syncProductToAlgolia(data)

  res.json({
    ...data,
    searchSynced,
  })
})

app.post('/api/orders', async (req, res) => {
  const { customerName, customerEmail, items } = req.body

  if (!customerName || !customerEmail || !items?.length) {
    return res.status(400).json({
      error: 'Customer name, email and cart items are required',
    })
  }

  const productIds = items.map((item) => item.productId)

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', productIds)

  if (productsError) {
    console.error('Database error:', productsError)
    return res.status(500).json({
      error: 'Failed to fetch products',
    })
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: customerName,
      customer_email: customerEmail,
    })
    .select()
    .single()

  if (orderError) {
    console.error('Database error:', orderError)
    return res.status(500).json({
      error: 'Failed to create order',
    })
  }

  const orderItems = items.map((item) => {
    const product = products.find(
      (product) => product.id === item.productId
    )

    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: item.quantity,
    }
  })

  const { data: createdItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)
    .select()

  if (itemsError) {
    console.error('Database error:', itemsError)
    return res.status(500).json({
      error: 'Failed to create order items',
    })
  }

  const total = createdItems.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * item.quantity,
    0
  )

  res.status(201).json({
    ...order,
    items: createdItems,
    total,
  })
})

app.get('/api/orders', async (req, res) => {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Database error:', ordersError)
    return res.status(500).json({
      error: 'Failed to fetch orders',
    })
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')

  if (itemsError) {
    console.error('Database error:', itemsError)
    return res.status(500).json({
      error: 'Failed to fetch order items',
    })
  }

  const ordersWithItems = orders.map((order) => {
    const items = orderItems.filter(
      (item) => item.order_id === order.id
    )

    const total = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    )

    return {
      ...order,
      items,
      total,
    }
  })

  res.json(ordersWithItems)
})

app.post('/api/import/csv', requireImportAdmin, async (req, res) => {
  try {
    const report = await importSupplierProducts('csv')
    res.json(report)
  } catch (error) {
    console.error('CSV import failed:', error)
    res.status(500).json({
      error: 'CSV import failed',
    })
  }
})

app.post('/api/import/xml', requireImportAdmin, async (req, res) => {
  try {
    const report = await importSupplierProducts('xml')
    res.json(report)
  } catch (error) {
    console.error('XML import failed:', error)
    res.status(500).json({
      error: 'XML import failed',
    })
  }
})

const searchQuerySchema = z.object({
  q: z.string().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

app.get('/api/search', async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid search parameters',
      details: parsed.error.issues,
    })
  }

  try {
    const { q, page, pageSize } = parsed.data
    const result = await searchProducts(q, page, pageSize)

    res.json(result)
  } catch (error) {
    console.error('Algolia search error:', error.message)

    res.status(503).json({
      error: 'Söktjänsten är tillfälligt otillgänglig.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

function requireImportAdmin(req, res, next) {
  const expectedKey = process.env.IMPORT_ADMIN_KEY
  const providedKey = req.get('X-Admin-Key')

  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(403).json({
      error: 'Forbidden',
    })
  }

  next()
}