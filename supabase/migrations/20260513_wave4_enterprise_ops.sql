-- Wave 4: finance adjustments (scholarships/discounts/waivers/late fees/refunds),
-- communications outbox, webhook operations hardening, job dead-letter visibility.

-- ---------------------------------------------------------------------------
-- Mobile money / provider webhooks — direct org link for RLS & reconciliation UI
-- ---------------------------------------------------------------------------
alter table public.payment_webhook_events
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_payment_webhook_events_org_created
  on public.payment_webhook_events (organization_id, created_at desc);

drop policy if exists "tenant read webhook events" on public.payment_webhook_events;
drop policy if exists "tenant read webhook events v2" on public.payment_webhook_events;

create policy "tenant read webhook events v2"
  on public.payment_webhook_events
  for select
  using (
    public.current_user_role() = 'super_admin'
    or public.can_access_org(organization_id)
    or (
      (payload ? 'organizationId')
      and (payload->>'organizationId') ~* '^[0-9a-f-]{36}$'
      and public.can_access_org((payload->>'organizationId')::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- Finance adjustments (approval-ready accounting hooks)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  adjustment_type text not null check (
    adjustment_type in (
      'scholarship',
      'discount',
      'waiver',
      'late_fee',
      'refund',
      'reversal',
      'write_off'
    )
  ),
  amount numeric(14,2) not null,
  percent numeric(6,2),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'posted', 'rejected')),
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  requested_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_adjustments_org_status
  on public.finance_adjustments (organization_id, status, created_at desc);

alter table public.finance_adjustments enable row level security;

drop policy if exists "tenant rw finance_adjustments" on public.finance_adjustments;

create policy "tenant rw finance_adjustments"
  on public.finance_adjustments
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Recurring billing templates (cron / worker can materialize invoices)
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  fee_category text not null,
  amount numeric(14,2) not null,
  cadence text not null check (cadence in ('term', 'monthly', 'annual', 'custom')),
  academic_year text not null,
  term text,
  next_run_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recurring_invoice_templates_org
  on public.recurring_invoice_templates (organization_id, active, next_run_on);

alter table public.recurring_invoice_templates enable row level security;

drop policy if exists "tenant rw recurring_invoice_templates" on public.recurring_invoice_templates;

create policy "tenant rw recurring_invoice_templates"
  on public.recurring_invoice_templates
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Installment plans (headline plan + lines optional — store schedule JSONB)
-- ---------------------------------------------------------------------------
create table if not exists public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  total_amount numeric(14,2) not null,
  schedule jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'defaulted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_installment_plans_org_student
  on public.installment_plans (organization_id, student_id);

alter table public.installment_plans enable row level security;

drop policy if exists "tenant rw installment_plans" on public.installment_plans;

create policy "tenant rw installment_plans"
  on public.installment_plans
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Communications outbox (SMS / WhatsApp-ready; worker consumes rows)
-- ---------------------------------------------------------------------------
create table if not exists public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'email', 'push')),
  recipient text not null,
  body text not null,
  related_student_id uuid references public.students(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'queued', 'sent', 'failed', 'dead')),
  provider_response jsonb,
  job_id uuid references public.background_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_message_outbox_org_status
  on public.message_outbox (organization_id, status, created_at desc);

alter table public.message_outbox enable row level security;

drop policy if exists "tenant rw message_outbox" on public.message_outbox;

create policy "tenant rw message_outbox"
  on public.message_outbox
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Background jobs — dead-letter & scheduling hints
-- ---------------------------------------------------------------------------
alter table public.background_jobs
  add column if not exists dead_letter boolean not null default false,
  add column if not exists dead_letter_at timestamptz,
  add column if not exists correlation_id text;

create index if not exists idx_background_jobs_dead
  on public.background_jobs (organization_id, dead_letter, status)
  where organization_id is not null;

-- Backfill webhook org for reconciliation center / RLS
update public.payment_webhook_events e
set organization_id = (e.payload->>'organizationId')::uuid
where e.organization_id is null
  and e.payload ? 'organizationId'
  and (e.payload->>'organizationId') ~* '^[0-9a-f-]{36}$';
