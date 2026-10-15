async function getExchangeRates() {
  const response = await fetch(
    'https://api.frankfurter.dev/v1/latest?base=SEK'
  )

  const data = await response.json()

  return data
}

module.exports = { getExchangeRates }