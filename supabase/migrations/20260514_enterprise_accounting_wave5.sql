-- Wave 5: accounting integrity (auto journals, COA hierarchy, period lock, immutable postings),
-- finance posting audit trail, reporting RPCs, cron-ready jobs, ERP global search.

-- ---------------------------------------------------------------------------
-- Fiscal periods & period locking
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists idx_fiscal_periods_org_range
  on public.fiscal_periods (organization_id, starts_on, ends_on);

alter table public.fiscal_periods enable row level security;

create policy "tenant rw fiscal_periods"
  on public.fiscal_periods
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Chart of accounts hierarchy
-- ---------------------------------------------------------------------------
alter table public.ledger_accounts
  add column if not exists parent_id uuid references public.ledger_accounts(id) on delete set null,
  add column if not exists is_system boolean not null default false,
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_ledger_accounts_parent on public.ledger_accounts (organization_id, parent_id);

-- ---------------------------------------------------------------------------
-- Journal lifecycle (posted = immutable lines / delete protection)
-- ---------------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists entry_status text not null default 'posted'
    check (entry_status in ('draft', 'posted', 'reversed')),
  add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_journal_entries_org_status on public.journal_entries (organization_id, entry_status);

-- ---------------------------------------------------------------------------
-- Idempotent links for automated postings
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists accrual_journal_entry_id uuid references public.journal_entries(id) on delete set null;

create unique index if not exists uq_invoices_accrual_journal
  on public.invoices (accrual_journal_entry_id)
  where accrual_journal_entry_id is not null;

alter table public.payments
  add column if not exists payment_journal_entry_id uuid references public.journal_entries(id) on delete set null;

create unique index if not exists uq_payments_payment_journal
  on public.payments (payment_journal_entry_id)
  where payment_journal_entry_id is not null;

alter table public.finance_adjustments
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete set null;

create unique index if not exists uq_finance_adjustments_journal
  on public.finance_adjustments (journal_entry_id)
  where journal_entry_id is not null;

-- ---------------------------------------------------------------------------
-- Append-only finance posting audit (immutable rows; no updates/deletes)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_posting_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  event_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_posting_audit_org_created
  on public.finance_posting_audit (organization_id, created_at desc);

alter table public.finance_posting_audit enable row level security;

create policy "tenant read finance_posting_audit"
  on public.finance_posting_audit
  for select
  using (public.can_access_org(organization_id));

-- No insert/update/delete policies for clients — rows written by triggers / definer functions only.

-- ---------------------------------------------------------------------------
-- Background jobs: cron / scheduling hints
-- ---------------------------------------------------------------------------
alter table public.background_jobs
  add column if not exists cron_expression text,
  add column if not exists scheduled_next_at timestamptz;

create index if not exists idx_background_jobs_scheduled
  on public.background_jobs (status, scheduled_next_at)
  where scheduled_next_at is not null;

-- ---------------------------------------------------------------------------
-- Installment / recurring late-fee hooks (JSON policy for workers)
-- ---------------------------------------------------------------------------
alter table public.installment_plans
  add column if not exists late_fee_policy jsonb not null default '{}'::jsonb;

alter table public.recurring_invoice_templates
  add column if not exists late_fee_flat numeric(14,2) not null default 0,
  add column if not exists grace_days integer not null default 0;

-- ---------------------------------------------------------------------------
-- Default chart of accounts (Uganda school–oriented buckets)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_ledger_accounts(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org is null then
    return;
  end if;

  insert into public.ledger_accounts (organization_id, code, name, account_type, is_system, sort_order)
  select p_org, v.code, v.name, v.account_type, true, v.sort_order
  from (
    values
      ('AR_FEES', 'Accounts receivable – student fees', 'asset', 100),
      ('CASH', 'Cash on hand', 'asset', 110),
      ('BANK', 'Bank accounts', 'asset', 120),
      ('MOMO_CLEARING', 'Mobile money clearing', 'asset', 130),
      ('INC_TUITION', 'Tuition & school fees income', 'income', 400),
      ('INC_LATE_FEE', 'Late fee income', 'income', 410),
      ('EXP_SCHOLARSHIP', 'Scholarships, discounts & waivers (contra-revenue)', 'expense', 500)
  ) as v(code, name, account_type, sort_order)
  where not exists (
    select 1 from public.ledger_accounts la
    where la.organization_id = p_org and la.code = v.code
  );
end;
$$;

create or replace function public.ledger_account_id(p_org uuid, p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.ledger_accounts
  where organization_id = p_org and code = p_code
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Finance posting audit writer
-- ---------------------------------------------------------------------------
create or replace function public.append_finance_posting_audit(
  p_org uuid,
  p_entry uuid,
  p_kind text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finance_posting_audit (organization_id, journal_entry_id, event_kind, payload, actor_id)
  values (p_org, p_entry, p_kind, coalesce(p_payload, '{}'::jsonb), auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Period lock enforcement
-- ---------------------------------------------------------------------------
create or replace function public.enforce_journal_fiscal_period()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.fiscal_periods fp
    where fp.organization_id = new.organization_id
      and new.entry_date between fp.starts_on and fp.ends_on
      and fp.locked
  ) then
    raise exception 'Accounting period is locked for date %', new.entry_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_journal_fiscal_period on public.journal_entries;
create trigger trg_enforce_journal_fiscal_period
before insert or update of entry_date, organization_id on public.journal_entries
for each row execute function public.enforce_journal_fiscal_period();

-- ---------------------------------------------------------------------------
-- Immutable posted journals
-- ---------------------------------------------------------------------------
create or replace function public.protect_posted_journal_lines()
returns trigger
language plpgsql
as $$
declare
  st text;
begin
  select je.entry_status into st
  from public.journal_entries je
  where je.id = coalesce(new.journal_entry_id, old.journal_entry_id);

  if st = 'posted' then
    raise exception 'Posted journal lines cannot be updated or deleted.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_posted_journal_lines on public.journal_lines;
create trigger trg_protect_posted_journal_lines
before update or delete on public.journal_lines
for each row execute function public.protect_posted_journal_lines();

create or replace function public.protect_posted_journal_entries()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.entry_status = 'posted' then
    raise exception 'Posted journal entries cannot be deleted.';
  end if;
  if tg_op = 'UPDATE' and old.entry_status = 'posted' then
    raise exception 'Posted journal entries cannot be modified.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_posted_journal_entries on public.journal_entries;
create trigger trg_protect_posted_journal_entries
before update or delete on public.journal_entries
for each row execute function public.protect_posted_journal_entries();

-- ---------------------------------------------------------------------------
-- Auto journal: invoice accrual (AR vs income)
-- ---------------------------------------------------------------------------
create or replace function public.auto_journal_invoice_accrual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ar uuid;
  v_inc uuid;
  v_entry uuid;
begin
  if new.accrual_journal_entry_id is not null then
    return new;
  end if;

  perform public.ensure_default_ledger_accounts(new.organization_id);
  v_ar := public.ledger_account_id(new.organization_id, 'AR_FEES');
  v_inc := public.ledger_account_id(new.organization_id, 'INC_TUITION');

  if v_ar is null or v_inc is null then
    raise notice 'Skipping invoice accrual journal — missing default accounts.';
    return new;
  end if;

  insert into public.journal_entries (
    organization_id, entry_date, reference, description, source, posted_by, entry_status, metadata
  ) values (
    new.organization_id,
    coalesce(new.created_at::date, current_date),
    'INV-' || left(new.id::text, 8),
    'Student fee invoice accrual',
    'invoice_accrual',
    auth.uid(),
    'draft',
    jsonb_build_object('invoice_id', new.id, 'student_id', new.student_id)
  )
  returning id into v_entry;

  insert into public.journal_lines (organization_id, journal_entry_id, account_id, debit, credit, student_id)
  values
    (new.organization_id, v_entry, v_ar, new.total_amount, 0, new.student_id),
    (new.organization_id, v_entry, v_inc, 0, new.total_amount, new.student_id);

  update public.journal_entries set entry_status = 'posted' where id = v_entry;

  update public.invoices set accrual_journal_entry_id = v_entry where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_invoice_accrual_journal on public.invoices;
create trigger trg_invoice_accrual_journal
after insert on public.invoices
for each row execute function public.auto_journal_invoice_accrual();

-- ---------------------------------------------------------------------------
-- Auto journal: successful payment (cash/MoMo vs AR)
-- ---------------------------------------------------------------------------
create or replace function public.auto_journal_payment_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ar uuid;
  v_asset uuid;
  v_entry uuid;
  v_asset_code text;
begin
  if new.status <> 'successful' or new.payment_journal_entry_id is not null then
    return new;
  end if;

  perform public.ensure_default_ledger_accounts(new.organization_id);
  v_ar := public.ledger_account_id(new.organization_id, 'AR_FEES');

  v_asset_code := case new.method
    when 'cash' then 'CASH'
    when 'mtn_momo' then 'MOMO_CLEARING'
    when 'airtel_money' then 'MOMO_CLEARING'
    when 'bank_transfer' then 'BANK'
    else 'CASH'
  end;

  v_asset := public.ledger_account_id(new.organization_id, v_asset_code);
  if v_ar is null or v_asset is null then
    raise notice 'Skipping payment journal — missing default accounts.';
    return new;
  end if;

  insert into public.journal_entries (
    organization_id,
    entry_date,
    reference,
    description,
    source,
    posted_by,
    entry_status,
    metadata
  ) values (
    new.organization_id,
    coalesce(new.paid_at::date, new.created_at::date, current_date),
    coalesce(new.transaction_ref, 'PAY-' || left(new.id::text, 8)),
    'Fee receipt',
    'payment_receipt',
    auth.uid(),
    'draft',
    jsonb_build_object('payment_id', new.id, 'invoice_id', new.invoice_id, 'student_id', new.student_id, 'method', new.method)
  )
  returning id into v_entry;

  insert into public.journal_lines (organization_id, journal_entry_id, account_id, debit, credit, student_id)
  values
    (new.organization_id, v_entry, v_asset, new.amount, 0, new.student_id),
    (new.organization_id, v_entry, v_ar, 0, new.amount, new.student_id);

  update public.journal_entries set entry_status = 'posted' where id = v_entry;

  update public.payments set payment_journal_entry_id = v_entry where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_payment_receipt_journal on public.payments;
create trigger trg_payment_receipt_journal
after insert or update of status on public.payments
for each row execute function public.auto_journal_payment_receipt();

-- ---------------------------------------------------------------------------
-- Auto journal: approved finance adjustments (scholarship / discount / waiver / late fee)
-- ---------------------------------------------------------------------------
create or replace function public.auto_journal_finance_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ar uuid;
  v_contra uuid;
  v_late uuid;
  v_entry uuid;
  v_amt numeric(14,2);
begin
  if new.journal_entry_id is not null then
    return new;
  end if;
  if new.status <> 'posted' or old.status = 'posted' then
    return new;
  end if;

  if new.adjustment_type in ('refund', 'reversal', 'write_off') then
    return new;
  end if;

  perform public.ensure_default_ledger_accounts(new.organization_id);
  v_ar := public.ledger_account_id(new.organization_id, 'AR_FEES');
  v_contra := public.ledger_account_id(new.organization_id, 'EXP_SCHOLARSHIP');
  v_late := public.ledger_account_id(new.organization_id, 'INC_LATE_FEE');

  v_amt := abs(new.amount);
  if v_amt = 0 or v_ar is null then
    return new;
  end if;

  insert into public.journal_entries (
    organization_id, entry_date, reference, description, source, posted_by, entry_status, metadata
  ) values (
    new.organization_id,
    current_date,
    'ADJ-' || left(new.id::text, 8),
    'Finance adjustment: ' || new.adjustment_type,
    'finance_adjustment',
    auth.uid(),
    'draft',
    jsonb_build_object('adjustment_id', new.id, 'type', new.adjustment_type, 'student_id', new.student_id)
  )
  returning id into v_entry;

  if new.adjustment_type = 'late_fee' then
    if v_late is null then
      delete from public.journal_entries where id = v_entry;
      return new;
    end if;
    insert into public.journal_lines (organization_id, journal_entry_id, account_id, debit, credit, student_id)
    values
      (new.organization_id, v_entry, v_ar, v_amt, 0, new.student_id),
      (new.organization_id, v_entry, v_late, 0, v_amt, new.student_id);
  else
    -- scholarship / discount / waiver reduce receivable via expense bucket
    if v_contra is null then
      delete from public.journal_entries where id = v_entry;
      return new;
    end if;
    insert into public.journal_lines (organization_id, journal_entry_id, account_id, debit, credit, student_id)
    values
      (new.organization_id, v_entry, v_contra, v_amt, 0, new.student_id),
      (new.organization_id, v_entry, v_ar, 0, v_amt, new.student_id);
  end if;

  update public.journal_entries set entry_status = 'posted' where id = v_entry;

  update public.finance_adjustments set journal_entry_id = v_entry where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_finance_adjustment_journal on public.finance_adjustments;
create trigger trg_finance_adjustment_journal
after update of status on public.finance_adjustments
for each row execute function public.auto_journal_finance_adjustment();

-- ---------------------------------------------------------------------------
-- Reporting RPCs (invoker — respects RLS on underlying tables)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_trial_balance(p_org uuid, p_from date, p_to date)
returns table (
  account_code text,
  account_name text,
  account_type text,
  debit_total numeric,
  credit_total numeric,
  net_balance numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.code,
    a.name,
    a.account_type,
    coalesce(sum(jl.debit) filter (where je.entry_date between p_from and p_to), 0)::numeric(14,2) as debit_total,
    coalesce(sum(jl.credit) filter (where je.entry_date between p_from and p_to), 0)::numeric(14,2) as credit_total,
    (
      coalesce(sum(jl.debit) filter (where je.entry_date between p_from and p_to), 0)
      - coalesce(sum(jl.credit) filter (where je.entry_date between p_from and p_to), 0)
    )::numeric(14,2) as net_balance
  from public.ledger_accounts a
  left join public.journal_lines jl on jl.account_id = a.id and jl.organization_id = p_org
  left join public.journal_entries je on je.id = jl.journal_entry_id and je.organization_id = p_org and je.entry_status = 'posted'
  where a.organization_id = p_org
    and public.can_access_org(p_org)
  group by a.id, a.code, a.name, a.account_type
  order by a.code;
$$;

create or replace function public.rpc_profit_and_loss(p_org uuid, p_from date, p_to date)
returns table (
  section text,
  amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select 'income'::text as section,
    coalesce(sum(jl.credit - jl.debit), 0)::numeric(14,2) as amount
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.ledger_accounts a on a.id = jl.account_id
  where jl.organization_id = p_org
    and je.entry_status = 'posted'
    and je.entry_date between p_from and p_to
    and a.account_type = 'income'
    and public.can_access_org(p_org)
  union all
  select 'expense'::text,
    coalesce(sum(jl.debit - jl.credit), 0)::numeric(14,2)
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.ledger_accounts a on a.id = jl.account_id
  where jl.organization_id = p_org
    and je.entry_status = 'posted'
    and je.entry_date between p_from and p_to
    and a.account_type = 'expense'
    and public.can_access_org(p_org);
$$;

create or replace function public.rpc_balance_sheet_summary(p_org uuid, p_as_of date)
returns table (
  bucket text,
  amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select 'assets'::text as bucket,
    coalesce(sum(
      case when a.account_type = 'asset' then jl.debit - jl.credit else 0 end
    ), 0)::numeric(14,2) as amount
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.ledger_accounts a on a.id = jl.account_id
  where jl.organization_id = p_org
    and je.entry_status = 'posted'
    and je.entry_date <= p_as_of
    and public.can_access_org(p_org)
  union all
  select 'liabilities',
    coalesce(sum(
      case when a.account_type = 'liability' then jl.credit - jl.debit else 0 end
    ), 0)::numeric(14,2)
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.ledger_accounts a on a.id = jl.account_id
  where jl.organization_id = p_org
    and je.entry_status = 'posted'
    and je.entry_date <= p_as_of
    and public.can_access_org(p_org)
  union all
  select 'equity',
    coalesce(sum(
      case when a.account_type = 'equity' then jl.credit - jl.debit else 0 end
    ), 0)::numeric(14,2)
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.ledger_accounts a on a.id = jl.account_id
  where jl.organization_id = p_org
    and je.entry_status = 'posted'
    and je.entry_date <= p_as_of
    and public.can_access_org(p_org);
$$;

create or replace function public.rpc_fee_aging_buckets(p_org uuid, p_as_of date)
returns table (
  bucket text,
  outstanding numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with open_inv as (
    select
      i.balance,
      greatest(0, p_as_of - coalesce(i.due_date, i.created_at::date))::integer as days_past_due
    from public.invoices i
    where i.organization_id = p_org
      and i.status in ('pending', 'partially_paid', 'overdue')
      and public.can_access_org(p_org)
      and i.balance > 0
  )
  select '0_30'::text,
    coalesce(sum(balance), 0)::numeric(14,2)
  from open_inv
  where days_past_due <= 30
  union all
  select '31_60',
    coalesce(sum(balance), 0)::numeric(14,2)
  from open_inv
  where days_past_due between 31 and 60
  union all
  select '61_plus',
    coalesce(sum(balance), 0)::numeric(14,2)
  from open_inv
  where days_past_due >= 61;
$$;

-- ---------------------------------------------------------------------------
-- ERP global search (SECURITY DEFINER — scoped to caller org)
-- ---------------------------------------------------------------------------
create or replace function public.erp_global_search(p_query text, p_limit int default 30)
returns table (
  result_type text,
  result_id uuid,
  label text,
  subtitle text,
  route_hint text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  lim int := greatest(1, least(p_limit, 50));
begin
  if p_query is null or length(trim(p_query)) < 2 then
    return;
  end if;

  v_org := public.current_org_id();
  if v_org is null or not public.can_access_org(v_org) then
    return;
  end if;

  return query
  select * from (
    select 'student'::text as result_type, s.id as result_id, s.full_name as label,
      coalesce(s.class_name, '') || ' · ' || coalesce(s.admission_number, '') as subtitle,
      '/dashboard/students/' || s.id::text as route_hint
    from public.students s
    where s.organization_id = v_org
      and (s.full_name ilike '%' || p_query || '%' or s.admission_number ilike '%' || p_query || '%')
    union all
    select 'staff', t.id, t.full_name, coalesce(t.phone, ''), '/dashboard/attendance'
    from public.teachers t
    where t.organization_id = v_org and t.full_name ilike '%' || p_query || '%'
    union all
    select 'invoice', i.id, 'Invoice ' || left(replace(i.id::text, '-', ''), 8),
      'Balance ' || i.balance::text,
      '/dashboard/fees'
    from public.invoices i
    where i.organization_id = v_org
      and (
        replace(i.id::text, '-', '') ilike '%' || replace(p_query, '-', '') || '%'
        or i.id::text ilike '%' || p_query || '%'
      )
    union all
    select 'payment', p.id, coalesce(p.transaction_ref, 'Payment'),
      p.amount::text || ' · ' || p.status,
      '/dashboard/finance-ops'
    from public.payments p
    where p.organization_id = v_org
      and (p.transaction_ref ilike '%' || p_query || '%' or p.id::text ilike '%' || p_query || '%')
  ) q
  limit lim;
end;
$$;

grant execute on function public.rpc_trial_balance(uuid, date, date) to authenticated;
grant execute on function public.rpc_profit_and_loss(uuid, date, date) to authenticated;
grant execute on function public.rpc_balance_sheet_summary(uuid, date) to authenticated;
grant execute on function public.rpc_fee_aging_buckets(uuid, date) to authenticated;
grant execute on function public.erp_global_search(text, int) to authenticated;
grant execute on function public.ensure_default_ledger_accounts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Journal entry audit (all sources: manual, invoice_accrual, payment, etc.)
-- ---------------------------------------------------------------------------
create or replace function public.log_journal_entry_to_finance_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.append_finance_posting_audit(
    new.organization_id,
    new.id,
    coalesce(new.source, 'journal'),
    jsonb_build_object(
      'reference', new.reference,
      'description', new.description,
      'entry_date', new.entry_date,
      'entry_status', new.entry_status,
      'metadata', new.metadata
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_journal_entry_finance_audit on public.journal_entries;
create trigger trg_journal_entry_finance_audit
after insert on public.journal_entries
for each row execute function public.log_journal_entry_to_finance_audit();

insert into public.permissions (code, description)
values
  ('finance.view_reports', 'View trial balance, P&L, and balance sheet summaries'),
  ('erp.global_search', 'Use ERP universal search across modules')
on conflict (code) do nothing;
