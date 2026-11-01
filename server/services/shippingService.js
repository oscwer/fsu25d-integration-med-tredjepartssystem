const SHIPPING_PRICES = {
  service_point: 59,
  home_delivery: 99,
}

const FREE_SHIPPING_THRESHOLD = 500

function calculateShipping(subtotal, deliveryMethod) {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error('Invalid order subtotal')
  }

  if (!Object.hasOwn(SHIPPING_PRICES, deliveryMethod)) {
    throw new Error('Invalid delivery method')
  }

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0
  }

  return SHIPPING_PRICES[deliveryMethod]
}

module.exports = {
  calculateShipping,
}
