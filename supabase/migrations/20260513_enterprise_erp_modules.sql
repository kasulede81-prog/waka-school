create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  address text,
  phone text,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_ugx numeric(14,2) not null default 0,
  max_students integer,
  max_staff integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  period_start date not null,
  period_end date not null,
  value bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, metric, period_start, period_end)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role_id)
);

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  academic_year text not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (organization_id, academic_year, name)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  level text,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  name text not null,
  exam_type text not null check (exam_type in ('continuous_assessment', 'midterm', 'final', 'mock', 'uneb_prep')),
  weight numeric(5,2) not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  score numeric(6,2) not null,
  max_score numeric(6,2) not null default 100,
  grade text,
  teacher_comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, exam_id, subject_id)
);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  full_name text not null,
  relationship text not null,
  phone text not null,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  document_type text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.student_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null check (event_type in ('admission', 'promotion', 'transfer', 'discipline', 'medical', 'fee', 'attendance')),
  title text not null,
  notes text,
  event_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.discipline_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  action_taken text,
  incident_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  name text not null,
  code text,
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  created_at timestamptz not null default now()
);

create table if not exists public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  pickup_point text,
  monthly_fee numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (route_id, student_id)
);

create table if not exists public.dormitories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  name text not null,
  gender text check (gender in ('male', 'female', 'mixed')),
  capacity integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bed_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dormitory_id uuid not null references public.dormitories(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  bed_label text not null,
  assigned_on date not null default current_date,
  released_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  symptoms text,
  diagnosis text,
  treatment text,
  medication text,
  outcome text,
  visit_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  isbn text,
  title text not null,
  author text,
  category text,
  copies_total integer not null default 1,
  copies_available integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  fine_amount numeric(14,2) not null default 0
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_date date not null default current_date,
  reference text,
  description text,
  source text,
  posted_by uuid references public.profiles(id),
  posted_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.ledger_accounts(id) on delete cascade,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and not (debit = 0 and credit = 0))
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount numeric(14,2) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_year text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  account_id uuid references public.ledger_accounts(id) on delete set null,
  line_name text not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  staff_name text not null,
  contract_type text not null,
  start_date date not null,
  end_date date,
  salary numeric(14,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_leaves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.salary_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  amount numeric(14,2) not null,
  reason text,
  recovered_amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'recovered')),
  created_at timestamptz not null default now()
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'failed', 'completed')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_org_class on public.students (organization_id, class_name);
create index if not exists idx_payments_org_status on public.payments (organization_id, status, created_at);
create index if not exists idx_invoices_org_status on public.invoices (organization_id, status, due_date);
create index if not exists idx_attendance_org_date on public.attendance (organization_id, attendance_date);
create index if not exists idx_marks_org_exam on public.marks (organization_id, exam_id);
create index if not exists idx_library_loans_org_due on public.library_loans (organization_id, due_at);
create index if not exists idx_background_jobs_status_after on public.background_jobs (status, run_after);

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    join public.permissions p on p.id = rp.permission_id
    where ura.user_id = auth.uid()
      and p.code = permission_code
  );
$$;

create or replace function public.validate_journal_balance()
returns trigger
language plpgsql
as $$
declare
  total_debit numeric(14,2);
  total_credit numeric(14,2);
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into total_debit, total_credit
  from public.journal_lines
  where journal_entry_id = new.journal_entry_id;

  if total_debit <> total_credit then
    raise exception 'Unbalanced journal entry: debit % credit %', total_debit, total_credit;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_journal_balance on public.journal_lines;
create constraint trigger trg_validate_journal_balance
after insert or update on public.journal_lines
deferrable initially deferred
for each row execute function public.validate_journal_balance();

alter table public.campuses enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.academic_terms enable row level security;
alter table public.subjects enable row level security;
alter table public.exams enable row level security;
alter table public.marks enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_documents enable row level security;
alter table public.student_events enable row level security;
alter table public.discipline_incidents enable row level security;
alter table public.transport_routes enable row level security;
alter table public.transport_assignments enable row level security;
alter table public.dormitories enable row level security;
alter table public.bed_assignments enable row level security;
alter table public.clinic_visits enable row level security;
alter table public.library_books enable row level security;
alter table public.library_loans enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.refunds enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;
alter table public.staff_contracts enable row level security;
alter table public.staff_leaves enable row level security;
alter table public.salary_advances enable row level security;
alter table public.background_jobs enable row level security;

-- Idempotent RLS policies (safe to re-run in SQL editor / repair)
drop policy if exists "tenant rw campuses" on public.campuses;
drop policy if exists "tenant rw subscriptions" on public.organization_subscriptions;
drop policy if exists "tenant rw usage counters" on public.usage_counters;
drop policy if exists "tenant rw roles" on public.roles;
drop policy if exists "tenant rw role permissions" on public.role_permissions;
drop policy if exists "tenant rw user roles" on public.user_role_assignments;
drop policy if exists "tenant rw academic terms" on public.academic_terms;
drop policy if exists "tenant rw subjects" on public.subjects;
drop policy if exists "tenant rw exams" on public.exams;
drop policy if exists "tenant rw marks" on public.marks;
drop policy if exists "tenant rw student guardians" on public.student_guardians;
drop policy if exists "tenant rw student docs" on public.student_documents;
drop policy if exists "tenant rw student events" on public.student_events;
drop policy if exists "tenant rw discipline incidents" on public.discipline_incidents;
drop policy if exists "tenant rw transport routes" on public.transport_routes;
drop policy if exists "tenant rw transport assignments" on public.transport_assignments;
drop policy if exists "tenant rw dormitories" on public.dormitories;
drop policy if exists "tenant rw bed assignments" on public.bed_assignments;
drop policy if exists "tenant rw clinic visits" on public.clinic_visits;
drop policy if exists "tenant rw library books" on public.library_books;
drop policy if exists "tenant rw library loans" on public.library_loans;
drop policy if exists "tenant rw ledger accounts" on public.ledger_accounts;
drop policy if exists "tenant rw journal entries" on public.journal_entries;
drop policy if exists "tenant rw journal lines" on public.journal_lines;
drop policy if exists "tenant rw refunds" on public.refunds;
drop policy if exists "tenant rw budgets" on public.budgets;
drop policy if exists "tenant rw budget lines" on public.budget_lines;
drop policy if exists "tenant rw staff contracts" on public.staff_contracts;
drop policy if exists "tenant rw staff leaves" on public.staff_leaves;
drop policy if exists "tenant rw salary advances" on public.salary_advances;
drop policy if exists "tenant rw background jobs" on public.background_jobs;

create policy "tenant rw campuses" on public.campuses for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw subscriptions" on public.organization_subscriptions for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw usage counters" on public.usage_counters for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw roles" on public.roles for all using (organization_id is null or public.can_access_org(organization_id)) with check (organization_id is null or public.can_access_org(organization_id));
create policy "tenant rw role permissions" on public.role_permissions for all using (organization_id is null or public.can_access_org(organization_id)) with check (organization_id is null or public.can_access_org(organization_id));
create policy "tenant rw user roles" on public.user_role_assignments for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw academic terms" on public.academic_terms for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw subjects" on public.subjects for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw exams" on public.exams for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw marks" on public.marks for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw student guardians" on public.student_guardians for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw student docs" on public.student_documents for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw student events" on public.student_events for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw discipline incidents" on public.discipline_incidents for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw transport routes" on public.transport_routes for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw transport assignments" on public.transport_assignments for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw dormitories" on public.dormitories for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw bed assignments" on public.bed_assignments for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw clinic visits" on public.clinic_visits for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw library books" on public.library_books for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw library loans" on public.library_loans for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw ledger accounts" on public.ledger_accounts for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw journal entries" on public.journal_entries for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw journal lines" on public.journal_lines for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw refunds" on public.refunds for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw budgets" on public.budgets for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw budget lines" on public.budget_lines for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw staff contracts" on public.staff_contracts for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw staff leaves" on public.staff_leaves for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw salary advances" on public.salary_advances for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant rw background jobs" on public.background_jobs for all using (organization_id is null or public.can_access_org(organization_id)) with check (organization_id is null or public.can_access_org(organization_id));

insert into public.permissions (code, description)
values
  ('finance.post_journal', 'Post accounting journal entries'),
  ('finance.manage_refunds', 'Approve and process refunds'),
  ('academics.enter_marks', 'Enter and update marks'),
  ('attendance.manage', 'Manage attendance records'),
  ('library.manage', 'Manage library inventory and loans'),
  ('boarding.manage', 'Manage dormitories and bed assignments'),
  ('transport.manage', 'Manage routes and transport assignments'),
  ('health.manage', 'Manage clinic records')
on conflict (code) do nothing;

