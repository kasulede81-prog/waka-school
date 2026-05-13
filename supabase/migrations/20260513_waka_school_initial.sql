create extension if not exists "pgcrypto";

create type public.school_role as enum (
  'super_admin',
  'school_director',
  'head_teacher',
  'bursar',
  'accountant',
  'teacher',
  'parent',
  'store_manager',
  'librarian'
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  phone text,
  email text,
  address text,
  school_type text not null check (school_type in ('nursery', 'primary', 'secondary', 'mixed', 'boarding', 'vocational')),
  currency text not null default 'UGX',
  active_academic_year text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  phone text unique,
  role public.school_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  date_of_birth date,
  admission_number text not null,
  class_name text not null,
  stream text,
  parent_phone text,
  parent_email text,
  address text,
  nationality text default 'Ugandan',
  status text not null default 'active' check (status in ('active', 'inactive', 'graduated', 'suspended')),
  medical_notes text,
  discipline_notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, admission_number)
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  relationship text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text not null,
  role public.school_role not null,
  salary numeric(14,2),
  national_id text,
  employment_status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  level text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (category in ('tuition', 'boarding', 'lunch', 'transport', 'development', 'uniform', 'uneb', 'exam')),
  amount numeric(14,2) not null,
  academic_year text not null,
  term text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  total_amount numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  balance numeric(14,2) generated always as (total_amount - amount_paid) stored,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'partially_paid', 'paid', 'overdue')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  method text not null check (method in ('mtn_momo', 'airtel_money', 'cash', 'bank_transfer', 'easypay')),
  phone_number text,
  transaction_ref text unique,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  exam_name text not null,
  academic_year text not null,
  term text not null,
  aggregate integer,
  division text,
  total_marks numeric(8,2),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_name text not null,
  category text not null,
  quantity integer not null default 0,
  unit text not null default 'pcs',
  reorder_level integer not null default 10,
  supplier_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email', 'push', 'in_app')),
  posted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  month text not null,
  gross_amount numeric(14,2) not null,
  deductions numeric(14,2) not null default 0,
  net_amount numeric(14,2) generated always as (gross_amount - deductions) stored,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.report_cards enable row level security;
alter table public.inventory enable row level security;
alter table public.announcements enable row level security;
alter table public.payroll enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_role()
returns public.school_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.can_access_org(target_org uuid)
returns boolean
language sql
stable
as $$
  select
    public.current_user_role() = 'super_admin'
    or public.current_org_id() = target_org
$$;

create policy "profiles self and super admin"
on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'super_admin');

create policy "org rows read"
on public.organizations for select
using (public.can_access_org(id));

create policy "org rows update director"
on public.organizations for update
using (public.can_access_org(id) and public.current_user_role() in ('super_admin', 'school_director'))
with check (public.can_access_org(id));

create policy "tenant read students" on public.students for select using (public.can_access_org(organization_id));
create policy "tenant write students" on public.students for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read parents" on public.parents for select using (public.can_access_org(organization_id));
create policy "tenant write parents" on public.parents for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read teachers" on public.teachers for select using (public.can_access_org(organization_id));
create policy "tenant write teachers" on public.teachers for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read classes" on public.classes for select using (public.can_access_org(organization_id));
create policy "tenant write classes" on public.classes for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read streams" on public.streams for select using (public.can_access_org(organization_id));
create policy "tenant write streams" on public.streams for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read attendance" on public.attendance for select using (public.can_access_org(organization_id));
create policy "tenant write attendance" on public.attendance for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read fees" on public.fees for select using (public.can_access_org(organization_id));
create policy "tenant write fees" on public.fees for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read payments" on public.payments for select using (public.can_access_org(organization_id));
create policy "tenant write payments" on public.payments for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read invoices" on public.invoices for select using (public.can_access_org(organization_id));
create policy "tenant write invoices" on public.invoices for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read report cards" on public.report_cards for select using (public.can_access_org(organization_id));
create policy "tenant write report cards" on public.report_cards for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read inventory" on public.inventory for select using (public.can_access_org(organization_id));
create policy "tenant write inventory" on public.inventory for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read announcements" on public.announcements for select using (public.can_access_org(organization_id));
create policy "tenant write announcements" on public.announcements for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read payroll" on public.payroll for select using (public.can_access_org(organization_id));
create policy "tenant write payroll" on public.payroll for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));
create policy "tenant read audit" on public.audit_logs for select using (public.can_access_org(organization_id));
create policy "tenant write audit" on public.audit_logs for all using (public.can_access_org(organization_id)) with check (public.can_access_org(organization_id));

