const express = require('express')
const cors = require('cors')
const supabase = require('./supabase')

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
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

  res.status(201).json(data)
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

  res.json(data)
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
