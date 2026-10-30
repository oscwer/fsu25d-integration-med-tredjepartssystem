const Stripe = require('stripe')

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  timeout: 10000,
  maxNetworkRetries: 1,
})

async function testStripeConnection() {
  return stripe.balance.retrieve()
}

async function createCheckoutSession(orderId, items, customerEmail) {
  const lineItems = items.map((item) => ({
    price_data: {
      currency: 'sek',
      product_data: {
        name: item.product_name,
      },
      unit_amount: Math.round(Number(item.unit_price) * 100),
    },
    quantity: item.quantity,
  }))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: String(orderId),
    customer_email: customerEmail,
    line_items: lineItems,
    success_url: `${process.env.CLIENT_URL}/?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/?payment_cancelled=1`,
  })

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  }
}

module.exports = {
  stripe,
  testStripeConnection,
  createCheckoutSession,
}
