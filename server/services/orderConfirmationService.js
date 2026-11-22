const { sendOrderConfirmation } = require('./emailService')

async function processOrderConfirmation(supabase, orderId) {
  // Försök reservera utskicket atomärt.
  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_order_confirmation',
    { p_order_id: orderId }
  )

  if (claimError) {
    throw claimError
  }

  if (!claimed) {
    console.log(`Order ${orderId}: confirmation already sent or claimed`)
    return
  }

  // Skicka bekräftelsen via Resend.
  const email = await sendOrderConfirmation(supabase, orderId)

  // Registrera ett accepterat utskick.
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      confirmation_email_sent_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'paid')
    .is('confirmation_email_sent_at', null)
    .not('confirmation_email_claimed_at', 'is', null)
    .select('id')
    .single()

  if (updateError) {
    throw updateError
  }

  console.log(
    `Order ${updatedOrder.id}: confirmation accepted by Resend (${email.id})`
  )
}

module.exports = { processOrderConfirmation }
