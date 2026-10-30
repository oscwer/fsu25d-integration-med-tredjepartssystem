const { algoliasearch } = require('algoliasearch')

const appId = process.env.ALGOLIA_APP_ID
const adminKey = process.env.ALGOLIA_ADMIN_API_KEY
const searchKey = process.env.ALGOLIA_SEARCH_API_KEY

const indexName = process.env.ALGOLIA_INDEX_NAME

function createAlgoliaClient(apiKey) {
  if (!appId || !apiKey || !indexName) {
    throw new Error('Missing Algolia configuration')
  }

  return algoliasearch(appId, apiKey)
}

function mapProductToSearchObject(product) {
  return {
    objectID: product.article_number || `local-${product.id}`,
    id: product.id,
    article_number: product.article_number,
    name: product.name,
    description: product.description,
    price: Number(product.price),
  }
}

async function indexProducts(products) {
  const objects = products.map(mapProductToSearchObject)

  if (objects.length === 0) {
    return 0
  }

  const tasks = await adminClient.saveObjects({
    indexName,
    objects,
  })

  // Vänta tills Algolia har behandlat alla indexeringsuppgifter
  for (const task of tasks) {
    await adminClient.waitForTask({
      indexName,
      taskID: task.taskID,
    })
  }

  return objects.length
}

async function removeProductFromIndex(product) {
  const objectID = product.article_number || `local-${product.id}`

  const task = await adminClient.deleteObject({
    indexName,
    objectID,
  })

  await adminClient.waitForTask({
    indexName,
    taskID: task.taskID,
  })
}

async function searchProducts(query, page, pageSize) {
  const result = await searchClient.searchSingleIndex({
    indexName,
    searchParams: {
      query,
      page: page - 1,
      hitsPerPage: pageSize,
    },
  })

  return {
    products: result.hits,
    total: result.nbHits,
    totalPages: result.nbPages,
    page,
    pageSize,
  }
}

const adminClient = createAlgoliaClient(adminKey)
const searchClient = createAlgoliaClient(searchKey)

module.exports = {
  adminClient,
  searchClient,
  indexName,
  mapProductToSearchObject,
  indexProducts,
  searchProducts,
  removeProductFromIndex,

}
