const supabase = require('../supabase')

async function upsertProducts(products) {
  // 1. Hämta artikelnumren för produkterna vi ska importera
  const articleNumbers = products.map(
    (product) => product.article_number
  )

  // 2. Kontrollera vilka produkter som redan finns
  const { data: existingProducts, error: selectError } =
    await supabase
      .from('products')
      .select('article_number')
      .in('article_number', articleNumbers)

  if (selectError) {
    throw new Error(
      `Failed to check existing products: ${selectError.message}`
    )
  }

  // 3. Skapa ett Set för snabba uppslag
  const existingNumbers = new Set(
    existingProducts.map((product) => product.article_number)
  )

  // 4. Räkna nya och uppdaterade produkter
  const created = products.filter(
    (product) => !existingNumbers.has(product.article_number)
  ).length

  const updated = products.length - created

  // 5. Anpassa produkterna till databasens kolumner
  const rows = products.map((product) => ({
    article_number: product.article_number,
    name: product.name,
    description: product.description,
    price: product.price,
  }))

  // 6. Spara produkterna med upsert
  const { error: upsertError } = await supabase
    .from('products')
    .upsert(rows, {
      onConflict: 'article_number',
    })

  if (upsertError) {
    throw new Error(
      `Database import failed: ${upsertError.message}`
    )
  }

  // 7. Returnera rapporten
  return {
    created,
    updated,
  }
}

module.exports = { upsertProducts }