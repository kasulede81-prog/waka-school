import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, serviceRoleKey)

type Provider = 'mtn_momo' | 'airtel_money'

interface PushPayload {
  provider: Provider
  phoneNumber: string
  amount: number
  reference: string
  externalId: string
}

function normalizeUgPhone(phone: string) {
  const clean = phone.replace(/\s+/g, '')
  if (/^\+2567\d{8}$/.test(clean)) return clean
  if (/^07\d{8}$/.test(clean)) return `+256${clean.slice(1)}`
  throw new Error('Invalid phone. Use +2567XXXXXXXX or 07XXXXXXXX')
}

async function requestMtnPush(payload: PushPayload) {
  const baseUrl = Deno.env.get('MTN_MOMO_BASE_URL')
  const apiUser = Deno.env.get('MTN_MOMO_API_USER')
  const apiKey = Deno.env.get('MTN_MOMO_API_KEY')
  const subscriptionKey = Deno.env.get('MTN_MOMO_SUBSCRIPTION_KEY')
  const targetEnv = Deno.env.get('MTN_MOMO_TARGET_ENV') ?? 'sandbox'
  const callbackUrl = Deno.env.get('MOBILE_MONEY_WEBHOOK_URL')

  if (!baseUrl || !apiUser || !apiKey || !subscriptionKey || !callbackUrl) {
    return {
      providerStatus: 'simulated',
      providerRequestId: `mtn-sim-${Date.now()}`,
      raw: { reason: 'Missing MTN env vars; using simulation mode.' },
    }
  }

  const basic = btoa(`${apiUser}:${apiKey}`)
  const tokenResp = await fetch(`${baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  })
  if (!tokenResp.ok) throw new Error(`MTN token request failed: ${tokenResp.status}`)
  const tokenJson = await tokenResp.json()
  const accessToken = tokenJson.access_token

  const requestId = crypto.randomUUID()
  const pushResp = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Reference-Id': requestId,
      'X-Target-Environment': targetEnv,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: payload.amount.toFixed(2),
      currency: 'UGX',
      externalId: payload.externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: payload.phoneNumber.replace('+', ''),
      },
      payerMessage: `School fees payment (${payload.reference})`,
      payeeNote: 'Waka School fees',
      metadata: {
        callbackUrl,
      },
    }),
  })

  return {
    providerStatus: pushResp.ok ? 'accepted' : 'rejected',
    providerRequestId: requestId,
    raw: { status: pushResp.status },
  }
}

async function requestAirtelPush(payload: PushPayload) {
  const baseUrl = Deno.env.get('AIRTEL_MONEY_BASE_URL')
  const clientId = Deno.env.get('AIRTEL_MONEY_CLIENT_ID')
  const clientSecret = Deno.env.get('AIRTEL_MONEY_CLIENT_SECRET')

  if (!baseUrl || !clientId || !clientSecret) {
    return {
      providerStatus: 'simulated',
      providerRequestId: `airtel-sim-${Date.now()}`,
      raw: { reason: 'Missing Airtel env vars; using simulation mode.' },
    }
  }

  const tokenResp = await fetch(`${baseUrl}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!tokenResp.ok) throw new Error(`Airtel token request failed: ${tokenResp.status}`)
  const tokenJson = await tokenResp.json()
  const accessToken = tokenJson.access_token

  const providerRequestId = crypto.randomUUID()
  const pushResp = await fetch(`${baseUrl}/merchant/v1/payments/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Country': 'UG',
      'X-Currency': 'UGX',
    },
    body: JSON.stringify({
      reference: payload.reference,
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: payload.phoneNumber.replace('+', ''),
      },
      transaction: {
        amount: payload.amount.toFixed(2),
        country: 'UG',
        currency: 'UGX',
        id: providerRequestId,
      },
    }),
  })

  return {
    providerStatus: pushResp.ok ? 'accepted' : 'rejected',
    providerRequestId,
    raw: { status: pushResp.status },
  }
}

async function requestProviderPush(payload: PushPayload) {
  if (payload.provider === 'mtn_momo') return requestMtnPush(payload)
  if (payload.provider === 'airtel_money') return requestAirtelPush(payload)
  return {
    providerStatus: 'accepted',
    providerRequestId: `${payload.provider}-${Date.now()}`,
    raw: { provider: payload.provider },
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { organizationId, invoiceId, studentId, phoneNumber, amount, provider } = await req.json()
  if (!organizationId || !invoiceId || !studentId || !phoneNumber || !amount || !provider) {
    return new Response('Missing fields', { status: 400 })
  }
  if (!['mtn_momo', 'airtel_money'].includes(provider)) {
    return new Response('Unsupported provider', { status: 400 })
  }

  const normalizedPhone = normalizeUgPhone(phoneNumber)
  const externalId = String(Date.now())
  const transactionRef = `waka-${provider}-${crypto.randomUUID()}`

  const { error: paymentError } = await supabase.from('payments').insert({
    organization_id: organizationId,
    invoice_id: invoiceId,
    student_id: studentId,
    method: provider,
    phone_number: normalizedPhone,
    amount,
    status: 'pending',
    transaction_ref: transactionRef,
    provider_name: provider,
  })
  if (paymentError) return new Response(paymentError.message, { status: 500 })

  const providerResult = await requestProviderPush({
    provider,
    phoneNumber: normalizedPhone,
    amount: Number(amount),
    reference: transactionRef,
    externalId,
  })

  await supabase
    .from('payments')
    .update({
      provider_request_id: providerResult.providerRequestId,
      provider_response: providerResult.raw,
      status: providerResult.providerStatus === 'rejected' ? 'failed' : 'pending',
    })
    .eq('transaction_ref', transactionRef)

  return Response.json({
    ok: true,
    transactionRef,
    provider: providerResult,
    message: 'Payment request sent to parent phone. Awaiting approval.',
  })
})

