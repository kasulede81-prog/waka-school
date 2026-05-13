import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const mtnWebhookSecret = Deno.env.get('MTN_MOMO_WEBHOOK_SECRET') ?? ''
const airtelWebhookSecret = Deno.env.get('AIRTEL_MONEY_WEBHOOK_SECRET') ?? ''

const supabase = createClient(url, serviceRole)

type PaymentStatus = 'pending' | 'successful' | 'failed'

function getProviderSecret(provider: string) {
  if (provider === 'mtn_momo') return mtnWebhookSecret
  if (provider === 'airtel_money') return airtelWebhookSecret
  return ''
}

async function verifyHmac(rawBody: string, signature: string, secret: string) {
  if (!secret) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return signature.toLowerCase() === expected.toLowerCase()
}

function normalizeStatus(providerStatus: string): PaymentStatus {
  const status = providerStatus.toLowerCase()
  if (['success', 'successful', 'completed'].includes(status)) return 'successful'
  if (['failed', 'cancelled', 'rejected'].includes(status)) return 'failed'
  return 'pending'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const payload = JSON.parse(rawBody)
  const provider = String(payload.provider ?? '')
  const signature = req.headers.get('x-signature') ?? req.headers.get('x-momo-signature') ?? ''
  const secret = getProviderSecret(provider)
  const verified = await verifyHmac(rawBody, signature, secret)
  const status = normalizeStatus(String(payload.status ?? 'pending'))
  const { transactionRef, amount, invoiceId, studentId, organizationId } = payload

  if (!transactionRef || !organizationId || !provider) {
    return new Response('Invalid payload', { status: 400 })
  }

  await supabase.from('payment_webhook_events').insert({
    transaction_ref: transactionRef,
    provider,
    signature,
    payload,
    verified,
  })

  if (!verified) {
    return new Response('Invalid signature', { status: 401 })
  }

  const { data: payment, error: paymentLookupError } = await supabase
    .from('payments')
    .select('id, invoice_id, student_id, amount, status')
    .eq('transaction_ref', transactionRef)
    .single()

  if (paymentLookupError || !payment) {
    return new Response('Payment not found', { status: 404 })
  }

  const paidAt = status === 'successful' ? new Date().toISOString() : null
  const targetInvoiceId = invoiceId ?? payment.invoice_id
  const targetStudentId = studentId ?? payment.student_id
  const targetAmount = Number(amount ?? payment.amount ?? 0)

  await supabase
    .from('payments')
    .update({
      status,
      amount: targetAmount,
      invoice_id: targetInvoiceId,
      student_id: targetStudentId,
      organization_id: organizationId,
      paid_at: paidAt,
      webhook_verified: true,
      processed_at: new Date().toISOString(),
      provider_name: provider,
      provider_response: payload,
    })
    .eq('transaction_ref', transactionRef)

  if (status === 'successful' && payment.status !== 'successful') {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('amount_paid, total_amount')
      .eq('id', targetInvoiceId)
      .single()
    const current = Number(invoice?.amount_paid ?? 0)
    const total = Number(invoice?.total_amount ?? 0)
    const nextPaid = Math.min(current + targetAmount, total)
    const invoiceStatus = nextPaid >= total ? 'paid' : 'partially_paid'
    await supabase
      .from('invoices')
      .update({ amount_paid: nextPaid, status: invoiceStatus })
      .eq('id', targetInvoiceId)
  }

  return Response.json({ ok: true, verified })
})

