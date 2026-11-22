
const supabase = require('../supabase')

async function findOrCreateCustomer(googleUser) {
  const { sub, email, name } = googleUser

  const { data: customer, error } = await supabase
    .from('customers')
    .upsert(
      {
        google_sub: sub,
        email,
        name,
      },
      {
        onConflict: 'google_sub',
      }
    )
    .select('id, name, email')
    .single()

  if (error) {
    throw new Error(`Could not save customer: ${error.message}`)
  }

  return customer
}

module.exports = { findOrCreateCustomer }
