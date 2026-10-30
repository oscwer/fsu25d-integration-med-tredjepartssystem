require('dotenv').config()

const supabase = require('../supabase')
const {
  indexProducts,
  indexName,
  adminClient,
} = require('../integrations/algoliaAdapter')

async function main() {
  // 1. Hämta produkterna från vår databas
  const { data: products, error } = await supabase
    .from('products')
    .select('id, article_number, name, description, price')
    .order('id', { ascending: true })

  if (error) {
    throw new Error(`Supabase error: ${error.message}`)
  }

  console.log('Produkter hämtade från Supabase:', products.length)

  // 2. Skicka produkterna till Algolia
  const indexedCount = await indexProducts(products)

  console.log('Produkter skickade till Algolia:', indexedCount)

  // 3. Vänta tills sökindexet är uppdaterat
  const result = await adminClient.searchSingleIndex({
    indexName,
    searchParams: {
      query: 'Kuddfodral',
      hitsPerPage: 5,
    },
  })

  console.log('Sökresultat:', result.nbHits)
  console.log('Första träffen:', result.hits[0]?.name)
}

main().catch((error) => {
  console.error('Indexering misslyckades:', error.message)
  process.exitCode = 1
})
