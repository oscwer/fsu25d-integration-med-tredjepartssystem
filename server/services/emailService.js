const { Resend } = require('resend')

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[char]
  })

async function sendOrderConfirmation(supabase, orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer_name,
      customer_email,
      shipping_cost,
      status,
      order_items (
        product_name,
        quantity,
        unit_price
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error('Could not load order for confirmation email')
  }

  if (order.status !== 'paid') {
    throw new Error('Cannot send confirmation for unpaid order')
  }

  const subtotal = order.order_items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  )

  const total = subtotal + Number(order.shipping_cost || 0)

  const formatPrice = (amount) =>
    new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
    }).format(amount)

  const rows = order.order_items.map((item) => `
    <tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${item.quantity}</td>
      <td>${formatPrice(Number(item.unit_price))}</td>
    </tr>
  `).join('')

  const html = `
    <h1>Tack för din beställning!</h1>
    <p>Hej ${escapeHtml(order.customer_name)}!</p>
    <p>Din betalning för order #${order.id} är genomförd.</p>
    <table>
      <thead>
        <tr><th>Produkt</th><th>Antal</th><th>Styckpris</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Frakt: ${formatPrice(Number(order.shipping_cost || 0))}</p>
    <p><strong>Totalt: ${formatPrice(total)}</strong></p>
  `

  const text = [
    `Tack för din beställning, ${order.customer_name}!`,
    `Ordernummer: ${order.id}`,
    ...order.order_items.map(
      (item) =>
        `${item.product_name}: ${item.quantity} × ${formatPrice(Number(item.unit_price))}`
    ),
    `Frakt: ${formatPrice(Number(order.shipping_cost || 0))}`,
    `Totalt: ${formatPrice(total)}`,
  ].join('\n')

  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error: sendError } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL,
      to: [order.customer_email],
      subject: `Orderbekräftelse #${order.id} – Oscar's Random Shop`,
      html,
      text,
    },
    {
      idempotencyKey: `order-confirmation-${order.id}`,
    }
  )

  if (sendError) {
    throw new Error(`Resend failed: ${sendError.message}`)
  }

  return data
}

module.exports = { sendOrderConfirmation }
