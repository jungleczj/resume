/**
 * Creem Payment Integration
 * Handles checkout creation and webhook processing
 */

interface CreemCheckoutParams {
  userId?: string
  anonymousId: string
  planType: 'per_export' | 'monthly' | 'yearly'
  format: 'pdf' | 'docx'
  amount: number
  currency: string
}

export async function createCreemCheckout(params: CreemCheckoutParams) {
  const response = await fetch('https://api.creem.io/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CREEM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace`,
      metadata: {
        user_id: params.userId,
        anonymous_id: params.anonymousId,
        plan_type: params.planType,
        format: params.format
      },
      line_items: [{
        price_data: {
          currency: params.currency,
          unit_amount: Math.round(params.amount * 100),
          product_data: {
            name: `Resume Export - ${params.planType}`
          }
        },
        quantity: 1
      }]
    })
  })

  if (!response.ok) throw new Error('Creem checkout creation failed')

  const data = await response.json()
  return { checkout_url: data.url, session_id: data.id }
}
