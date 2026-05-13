alter table public.payments
  add column if not exists provider_request_id text,
  add column if not exists provider_name text,
  add column if not exists provider_response jsonb,
  add column if not exists webhook_verified boolean not null default false,
  add column if not exists processed_at timestamptz;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  transaction_ref text,
  provider text not null,
  signature text,
  payload jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;

create policy "tenant read webhook events"
on public.payment_webhook_events
for select
using (
  public.current_user_role() = 'super_admin'
  or (
    (payload ? 'organizationId')
    and (payload->>'organizationId') ~* '^[0-9a-f-]{36}$'
    and public.can_access_org((payload->>'organizationId')::uuid)
  )
);

