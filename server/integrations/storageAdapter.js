const { randomUUID } = require('node:crypto')
const supabase = require('../supabase')

const BUCKET = 'product-images'

async function uploadProductImage(productId, file) {
  const extension = file.mimetype === 'image/png' ? 'png' : 'jpg'

  const path = `products/${productId}/${randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return {
    path,
    url: data.publicUrl,
  }
}

async function deleteProductImage(path) {
  if (!path) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    throw new Error(`Storage deletion failed: ${error.message}`)
  }
}

module.exports = {
  uploadProductImage,
  deleteProductImage,
}
