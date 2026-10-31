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
  removeProductFromIndex,
} = require('./integrations/algoliaAdapter')

const {
  stripe,
  createCheckoutSession,
} = require('./integrations/stripeAdapter')

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
    .eq('is_active', true)

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

const checkoutSchema = z.object({
  customerName: z.string().trim().min(1),
  customerEmail: z.email(),
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1),
    })
  ).min(1),
})

const app = express()
const PORT = 3000

app.use(cors())

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature']

    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (error) {
      console.error('Invalid Stripe webhook signature:', error.message)

      return res.status(400).json({
        error: 'Invalid webhook signature',
      })
    }

    try {
      console.log('Verified Stripe event:', event.type)

      const paymentEvents = [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ]

      if (paymentEvents.includes(event.type)) {
        const session = event.data.object

        // En slutförd Checkout-session betyder inte alltid
        // att betalningen faktiskt är bekräftad.
        if (session.payment_status !== 'paid') {
          console.log('Payment not yet confirmed:', session.id)
          return res.json({ received: true })
        }

        // Hitta ordern via Stripe-sessionens ID.
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('stripe_session_id', session.id)
          .single()

        if (orderError || !order) {
          throw new Error(`Order not found for session ${session.id}`)
        }

        if (session.client_reference_id !== String(order.id)) {
          throw new Error('Stripe session and order ID do not match')
        }

        // Databasen sköter status och lager atomärt.
        const { data: result, error: paymentError } = await supabase.rpc(
          'finalize_stripe_payment',
          {
            p_order_id: order.id,
            p_session_id: session.id,
          }
        )

        if (paymentError) {
          throw new Error(paymentError.message)
        }

        console.log(`Order ${order.id}: ${result}`)
      }

      if (event.type === 'checkout.session.expired') {
        const session = event.data.object

        const { data: cancelledOrder, error } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (error) {
          throw new Error(error.message)
        }

        if (cancelledOrder) {
          console.log(`Order ${cancelledOrder.id}: cancelled`)
        } else {
          console.log(`No pending order to cancel for ${session.id}`)
        }
      }

      return res.status(200).json({ received: true })
      } catch (error) {
        console.error('Stripe webhook processing failed:', error.message)

        return res.status(500).json({
          error: 'Webhook processing failed',
        })
      }
      }
    )

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
    .eq('is_active', true)

  if (error) {
    console.error('Database error:', error)
    return res.status(500).json({
      error: 'Failed to fetch products',
    })
  }

  res.json(data)
})

app.post('/api/products', requireImportAdmin, async (req, res) => {
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

app.put('/api/products/:id', requireImportAdmin, async (req, res) => {
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

app.delete('/api/products/:id', requireImportAdmin, async (req, res) => {
  const { id } = req.params

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid product ID',
    })
  }

  // Arkivera produkten i Supabase
  const { data: product, error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id)
    .eq('is_active', true)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Archive error:', error.message)

    return res.status(500).json({
      error: 'Failed to archive product',
    })
  }

  if (!product) {
    return res.status(404).json({
      error: 'Active product not found',
    })
  }

  // Försök ta bort produkten från Algolia
  let searchSynced = false

  try {
    await removeProductFromIndex(product)
    searchSynced = true
  } catch (error) {
    console.error('Algolia deletion failed:', error.message)
  }

  res.json({
    message: 'Product archived',
    productId: product.id,
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

app.post('/api/checkout', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid checkout data',
      details: parsed.error.issues,
    })
  }

  try {
    const { customerName, customerEmail, items } = parsed.data

    // Samla antal per produkt-ID.
    const quantities = new Map()

    for (const item of items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) || 0) + item.quantity
      )
    }

    const productIds = [...quantities.keys()]

    // Hämta priser och lager från databasen.
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, stock, is_active')
      .in('id', productIds)

    if (error) {
      throw new Error(error.message)
    }

    // Kontrollera att alla beställda produkter är köpbara.
    for (const productId of productIds) {
      const product = products.find(p => p.id === productId)
      const quantity = quantities.get(productId)

      if (!product || !product.is_active) {
        return res.status(400).json({
          error: `Product ${productId} is unavailable`,
        })
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}`,
        })
      }
    }

    // Beräkna totalpriset på servern.
    const total = products.reduce(
      (sum, product) =>
        sum + Number(product.price) * quantities.get(product.id),
      0
    )

    // 1. Skapa en order med status pending
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        status: 'pending',
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Could not create order: ${orderError.message}`)
    }

    // 2. Skapa orderrader med priser från Supabase
    const orderItems = products.map((product) => ({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      unit_price: Number(product.price),
      quantity: quantities.get(product.id),
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      // Ordern skapades, men gick inte att färdigställa
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'pending')

      throw new Error(`Could not create order items: ${itemsError.message}`)
    }

    // 3. Skapa Stripe Checkout-sessionen
    let checkout

    try {
      checkout = await createCheckoutSession(
        order.id,
        orderItems,
        customerEmail
      )
    } catch (error) {
      // Ingen fungerande betalningssession skapades
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'pending')

      throw error
    }

    // 4. Koppla Stripe-sessionens ID till ordern
    const { error: sessionError } = await supabase
      .from('orders')
      .update({
        stripe_session_id: checkout.sessionId,
      })
      .eq('id', order.id)
      .select()
      .single()

    if (sessionError) {
      // Förhindra om möjligt att en okopplad session betalas
      try {
        await stripe.checkout.sessions.expire(checkout.sessionId)
      } catch (expireError) {
        console.error('Could not expire Stripe session:', expireError.message)
      }

      throw new Error(`Could not save Stripe session: ${sessionError.message}`)
    }

    // 5. Returnera betalningsadressen till React
    res.status(201).json({
      orderId: order.id,
      checkoutUrl: checkout.checkoutUrl,
      total,
      currency: 'SEK',
      status: 'pending',
    })
  } catch (error) {
    console.error('Checkout error:', error.message)

    res.status(500).json({
      error: 'Could not validate checkout',
    })
  }
})

app.get('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid order ID' })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, stripe_session_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return res.status(500).json({
      error: 'Failed to fetch order status',
    })
  }

  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  // Returnera inte kundens personuppgifter.
  res.json({
    id: order.id,
    status: order.status,
    stripeSessionId: order.stripe_session_id,
  })
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