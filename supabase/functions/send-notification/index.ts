import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(url, serviceRole)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { organizationId, channel, title, body, postedBy } = await req.json()
  if (!organizationId || !channel || !title || !body) {
    return new Response('Missing fields', { status: 400 })
  }

  const { error } = await supabase.from('announcements').insert({
    organization_id: organizationId,
    channel,
    title,
    body,
    posted_by: postedBy ?? null,
  })

  if (error) return new Response(error.message, { status: 500 })

  return Response.json({ queued: true })
})

