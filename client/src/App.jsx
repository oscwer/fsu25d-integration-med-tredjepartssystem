import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || ''



function App() {
  const [serverStatus, setServerStatus] = useState('Checking server...')
  const [products, setProducts] = useState([])
  const [currency, setCurrency] = useState('SEK')
  const [exchangeRates, setExchangeRates] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [formError, setFormError] = useState('')
  const [editingProductId, setEditingProductId] = useState(null)
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [orderConfirmation, setOrderConfirmation] = useState(null)
  const [orders, setOrders] = useState([])

  const [activeView, setActiveView] = useState('shop')

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  const cartItemCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  function convertPrice(price) {
    if (currency === 'SEK' || !exchangeRates) {
      return Number(price)
    }

    const rate = exchangeRates[currency]
    return Number(price) * rate
  }

  function formatPrice(price) {
    const convertedPrice = convertPrice(price)

    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
    }).format(convertedPrice)
  }

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => {
        setServerStatus(data.status)
      })
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((response) => response.json())
      .then((data) => {
        setProducts(data)
     })
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/api/orders`)
      .then((response) => response.json())
      .then((data) => {
        setOrders(data)
      })
  }, [])

  useEffect(() => {
    async function fetchExchangeRates() {
      try {
        const response = await fetch(`${API_URL}/api/currencies`)

        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates')
        }

        const data = await response.json()

        setExchangeRates(data.rates)
        console.log('Exchange rates:', data.rates)
      } catch (error) {
        console.error('Currency error:', error)
      }
    }

    fetchExchangeRates()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    const url = editingProductId
      ? `${API_URL}/api/products/${editingProductId}`
      : `${API_URL}/api/products`

    const method = editingProductId ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        price: Number(price),
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setFormError(result.error || 'Failed to create product')
      return
    }

   if (editingProductId) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === editingProductId ? result : product
      )
    )
  } else {
    setProducts((currentProducts) => [
      ...currentProducts,
      result,
    ])
  }

    setName('')
    setDescription('')
    setPrice('')
    setFormError('')
    setEditingProductId(null)
  }

  function handleEdit(product) {
    setEditingProductId(product.id)
    setName(product.name)
    setDescription(product.description || '')
    setPrice(String(product.price))
    setFormError('')
  }

 function handleAddToCart(product) {
  setCart((currentCart) => {
    const existingItem = currentCart.find(
      (item) => item.id === product.id
    )

    if (existingItem) {
      return currentCart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    }

    return [
      ...currentCart,
      {
        ...product,
        quantity: 1,
      },
    ]
  })
}

  async function handleCheckout(event) {
    event.preventDefault()

    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName,
        customerEmail,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setCheckoutError(result.error || 'Failed to place order')
      return
    }

    setOrderConfirmation(result)
    setOrders((currentOrders) => [
      result,
      ...currentOrders,
    ])
    setCheckoutError('')
    setCart([])
    setCustomerName('')
    setCustomerEmail('')
  }

  return (
    <main className="app">

      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            type="button"
            onClick={() => setActiveView('shop')}
          >
            OSCAR'S RANDOM SHOP
          </button>

          <nav className="main-nav">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              aria-label="Select currency"
            >
              <option value="SEK">SEK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="DKK">DKK</option>
            </select>
            <button
              className={activeView === 'shop' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setActiveView('shop')}
            >
              Shop
            </button>

            <button
              className="cart-indicator"
              type="button"
              onClick={() => {
                setActiveView('shop')

                requestAnimationFrame(() => {
                  document
                    .querySelector('#cart')
                    ?.scrollIntoView({ behavior: 'smooth' })
                })
              }}
            >
              Cart
              {cartItemCount > 0 && (
                <span className="cart-count">{cartItemCount}</span>
              )}
            </button>

            <button
              className={activeView === 'admin' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setActiveView('admin')}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      {activeView === 'shop' && (
        <div className="page-container">
          <section className="hero">
            <p className="eyebrow">Curated essentials</p>
            <h1>Everyday objects, thoughtfully selected.</h1>
            <p className="hero-text">
              A simple collection of products made for everyday life.
            </p>
          </section>

          <section className="product-section">
            <div className="section-heading">
              <h2>Shop all</h2>
              <p>{products.length} products</p>
            </div>

            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image-placeholder">
                    <span>{product.name.charAt(0)}</span>
                  </div>

                  <div className="product-card-content">
                    <div>
                      <h3>{product.name}</h3>
                      <p className="product-description">
                        {product.description}
                      </p>
                    </div>

                    <div className="product-card-footer">
                      <strong>{formatPrice(product.price)}</strong>

                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleAddToCart(product)}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="cart" className="cart-section">
            <div className="cart-panel">
              <div className="cart-header">
                <div>
                  <p className="eyebrow">Your selection</p>
                  <h2>Shopping cart</h2>
                </div>

                <p className="cart-summary">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                </p>
              </div>

              {cart.length === 0 ? (
                <div className="empty-cart">
                  <p>Your cart is empty.</p>
                  <p>Add something you like from the collection above.</p>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cart.map((item) => (
                      <div className="cart-item" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <p>
                            {item.quantity} × {formatPrice(item.price)}
                          </p>
                        </div>

                        <strong>
                          {formatPrice(item.price * item.quantity)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{formatPrice(cartTotal)}</strong>
                  </div>

                  <form className="checkout-form" onSubmit={handleCheckout}>
                    <div className="checkout-heading">
                      <h3>Checkout</h3>
                      <p>Enter your details to place the order.</p>
                    </div>

                    <div className="form-field">
                      <label htmlFor="customerName">Name</label>
                      <input
                        id="customerName"
                        type="text"
                        required
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="customerEmail">Email</label>
                      <input
                        id="customerEmail"
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                      />
                    </div>

                    {checkoutError && (
                      <p className="form-error">{checkoutError}</p>
                    )}

                    <button className="checkout-button" type="submit">
                      Place order
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>

        {orderConfirmation && (
          <section className="order-confirmation">
            <div className="confirmation-icon" aria-hidden="true">
              ✓
            </div>

            <div>
              <p className="eyebrow">Order complete</p>
              <h2>Thanks for your order.</h2>
              <p>
                Order #{orderConfirmation.id} has been placed successfully.
              </p>
            </div>
          </section>
        )}
        </div>
    )}

      {activeView === 'admin' && (
        <div className="page-container admin-page">
          <section className="admin-header">
            <div>
              <p className="eyebrow">Shop management</p>
              <h1>Admin</h1>
              <p>
                Manage products and review incoming orders.
              </p>
            </div>

            <div className="server-status">
              <span
                className={
                  serverStatus === 'ok'
                    ? 'status-dot online'
                    : 'status-dot'
                }
              />
              {serverStatus === 'ok' ? 'API online' : 'API unavailable'}
            </div>
          </section>

          <div className="admin-grid">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>
                  {editingProductId ? 'Edit product' : 'Add product'}
                </h2>
                <p>
                  {editingProductId
                    ? 'Update the selected product.'
                    : 'Add a new product to the store.'}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="price">Price</label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </div>

                {formError && (
                  <p className="form-error">{formError}</p>
                )}

                <button className="primary-button" type="submit">
                  {editingProductId ? 'Save changes' : 'Add product'}
                </button>
              </form>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Products</h2>
                <p>{products.length} products in the store.</p>
              </div>

              <div className="admin-product-list">
                {products.map((product) => (
                  <div className="admin-product-row" key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <p>{formatPrice(product.price)}</p>
                    </div>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleEdit(product)}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="admin-orders">
            <div className="admin-panel-heading">
              <h2>Orders</h2>
              <p>{orders.length} orders received.</p>
            </div>

            {orders.length === 0 ? (
              <div className="empty-admin-state">
                <p>No orders yet.</p>
              </div>
            ) : (
              <div className="order-list">
                {orders.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-header">
                      <div>
                        <h3>Order #{order.id}</h3>
                        <p>
                          {order.customer_name} · {order.customer_email}
                        </p>
                      </div>

                      <strong>{formatPrice(order.total)}</strong>
                    </div>

                    <div className="order-lines">
                      {order.items.map((item) => (
                        <div className="order-line" key={item.id}>
                          <span>
                            {item.quantity} × {item.product_name}
                          </span>

                          <span>
                            {formatPrice(item.unit_price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <strong className="footer-brand">OSCAR'S RANDOM SHOP</strong>
            <p>Thoughtfully selected everyday essentials.</p>
          </div>

          <p className="footer-meta">
            Built with React, Express and Supabase.
          </p>
        </div>
      </footer>
    </main>
  )
}

export default App