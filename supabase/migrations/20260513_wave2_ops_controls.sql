create table if not exists public.cashier_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2),
  expected_balance numeric(14,2),
  variance numeric(14,2),
  status text not null default 'open' check (status in ('open', 'closed'))
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  statement_date date not null,
  reference text not null,
  narration text,
  amount numeric(14,2) not null,
  direction text not null check (direction in ('credit', 'debit')),
  matched boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  statement_line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  matched_by uuid references public.profiles(id) on delete set null,
  matched_at timestamptz not null default now(),
  notes text,
  unique (payment_id, statement_line_id)
);

create table if not exists public.archival_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  retention_months integer not null check (retention_months > 0),
  archive_after_days integer not null check (archive_after_days > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, module)
);

create table if not exists public.archival_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  archived_rows integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  backup_scope text not null check (backup_scope in ('tenant', 'platform')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  storage_uri text,
  checksum text,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cashier_sessions_org_status on public.cashier_sessions (organization_id, status, opened_at);
create index if not exists idx_bank_statement_org_match on public.bank_statement_lines (organization_id, matched, statement_date);
create index if not exists idx_recon_matches_org on public.reconciliation_matches (organization_id, matched_at);
create index if not exists idx_archival_runs_org_status on public.archival_runs (organization_id, status, created_at);
create index if not exists idx_backup_runs_scope_status on public.backup_runs (backup_scope, status, created_at);

alter table public.cashier_sessions enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.reconciliation_matches enable row level security;
alter table public.archival_policies enable row level security;
alter table public.archival_runs enable row level security;
alter table public.backup_runs enable row level security;

create policy "tenant rw cashier sessions" on public.cashier_sessions for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw bank statement lines" on public.bank_statement_lines for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw reconciliation matches" on public.reconciliation_matches for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw archival policies" on public.archival_policies for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw archival runs" on public.archival_runs for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw backup runs" on public.backup_runs for all
using (
  organization_id is null
  or public.can_access_org(organization_id)
)
with check (
  organization_id is null
  or public.can_access_org(organization_id)
);

insert into public.permissions (code, description) values
  ('finance.reconcile', 'Reconcile payments with bank statements'),
  ('finance.cashier.close', 'Open and close cashier sessions'),
  ('admin.approvals.review', 'Review and resolve approval requests'),
  ('ops.archive.manage', 'Run archival operations'),
  ('ops.backup.manage', 'Run backup and restore workflows')
on conflict (code) do nothing;

