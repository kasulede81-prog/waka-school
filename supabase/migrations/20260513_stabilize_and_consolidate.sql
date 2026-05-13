create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  entity_table text not null,
  entity_id uuid,
  request_type text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists public.data_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  export_type text not null check (export_type in ('csv', 'xlsx', 'pdf', 'print')),
  filters jsonb not null default '{}'::jsonb,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_org_name on public.students (organization_id, full_name);
create index if not exists idx_students_org_admission on public.students (organization_id, admission_number);
create index if not exists idx_attendance_org_student_date on public.attendance (organization_id, student_id, attendance_date);
create index if not exists idx_marks_org_student on public.marks (organization_id, student_id);
create index if not exists idx_journal_entries_org_posted on public.journal_entries (organization_id, posted_at);
create index if not exists idx_approvals_org_status on public.approval_requests (organization_id, status, created_at);
create index if not exists idx_audit_org_created on public.audit_logs (organization_id, created_at);

create or replace function public.assert_same_org(entity_org uuid, table_name text)
returns void
language plpgsql
as $$
begin
  if entity_org is null then
    raise exception 'Missing organization on %', table_name;
  end if;
  if entity_org <> public.current_org_id() and public.current_user_role() <> 'super_admin' then
    raise exception 'Cross-tenant access denied on %', table_name;
  end if;
end;
$$;

create or replace function public.validate_finance_links()
returns trigger
language plpgsql
as $$
declare
  invoice_org uuid;
  student_org uuid;
begin
  if tg_table_name = 'payments' then
    select organization_id into invoice_org from public.invoices where id = new.invoice_id;
    select organization_id into student_org from public.students where id = new.student_id;
    if invoice_org is null or student_org is null then
      raise exception 'Invalid invoice or student reference in payments';
    end if;
    if new.organization_id <> invoice_org or new.organization_id <> student_org then
      raise exception 'Organization mismatch in payments relation';
    end if;
  elsif tg_table_name = 'journal_lines' then
    select organization_id into invoice_org from public.journal_entries where id = new.journal_entry_id;
    select organization_id into student_org from public.ledger_accounts where id = new.account_id;
    if invoice_org is null or student_org is null then
      raise exception 'Invalid journal entry or account reference';
    end if;
    if new.organization_id <> invoice_org or new.organization_id <> student_org then
      raise exception 'Organization mismatch in journal lines relation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_payments_org on public.payments;
create trigger trg_validate_payments_org
before insert or update on public.payments
for each row execute function public.validate_finance_links();

drop trigger if exists trg_validate_journal_lines_org on public.journal_lines;
create trigger trg_validate_journal_lines_org
before insert or update on public.journal_lines
for each row execute function public.validate_finance_links();

create or replace function public.record_audit_event()
returns trigger
language plpgsql
as $$
declare
  action_name text;
  target_id uuid;
  target_org uuid;
begin
  action_name := tg_op;
  if tg_op = 'DELETE' then
    target_id := old.id;
    target_org := old.organization_id;
  else
    target_id := new.id;
    target_org := new.organization_id;
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, metadata)
  values (
    target_org,
    auth.uid(),
    tg_table_name || ':' || lower(action_name),
    jsonb_build_object('record_id', target_id, 'table', tg_table_name)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_students on public.students;
create trigger trg_audit_students after insert or update or delete on public.students
for each row execute function public.record_audit_event();

drop trigger if exists trg_audit_attendance on public.attendance;
create trigger trg_audit_attendance after insert or update or delete on public.attendance
for each row execute function public.record_audit_event();

drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices after insert or update or delete on public.invoices
for each row execute function public.record_audit_event();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments after insert or update or delete on public.payments
for each row execute function public.record_audit_event();

drop trigger if exists trg_audit_journal_entries on public.journal_entries;
create trigger trg_audit_journal_entries after insert or update or delete on public.journal_entries
for each row execute function public.record_audit_event();

drop trigger if exists trg_audit_journal_lines on public.journal_lines;
create trigger trg_audit_journal_lines after insert or update or delete on public.journal_lines
for each row execute function public.record_audit_event();

drop policy if exists "tenant write payroll" on public.payroll;
drop policy if exists "tenant write payments" on public.payments;
drop policy if exists "tenant write invoices" on public.invoices;
drop policy if exists "tenant rw journal entries" on public.journal_entries;
drop policy if exists "tenant rw journal lines" on public.journal_lines;
drop policy if exists "tenant rw refunds" on public.refunds;

create policy "finance write payments restricted"
on public.payments for insert
with check (
  public.can_access_org(organization_id)
  and (
    public.current_user_role() in ('super_admin', 'school_director', 'bursar', 'accountant')
    or public.has_permission('finance.post_journal')
  )
);

create policy "finance update payments restricted"
on public.payments for update
using (
  public.can_access_org(organization_id)
  and (
    public.current_user_role() in ('super_admin', 'school_director', 'bursar', 'accountant')
    or public.has_permission('finance.post_journal')
  )
)
with check (public.can_access_org(organization_id));

create policy "finance write invoices restricted"
on public.invoices for all
using (
  public.can_access_org(organization_id)
  and public.current_user_role() in ('super_admin', 'school_director', 'bursar', 'accountant')
)
with check (public.can_access_org(organization_id));

create policy "finance write payroll restricted"
on public.payroll for all
using (
  public.can_access_org(organization_id)
  and public.current_user_role() in ('super_admin', 'school_director', 'accountant', 'hr_manager')
)
with check (public.can_access_org(organization_id));

create policy "finance write journal entries restricted"
on public.journal_entries for all
using (
  public.can_access_org(organization_id)
  and (
    public.current_user_role() in ('super_admin', 'school_director', 'accountant')
    or public.has_permission('finance.post_journal')
  )
)
with check (public.can_access_org(organization_id));

create policy "finance write journal lines restricted"
on public.journal_lines for all
using (
  public.can_access_org(organization_id)
  and (
    public.current_user_role() in ('super_admin', 'school_director', 'accountant')
    or public.has_permission('finance.post_journal')
  )
)
with check (public.can_access_org(organization_id));

create policy "finance write refunds restricted"
on public.refunds for all
using (
  public.can_access_org(organization_id)
  and (
    public.current_user_role() in ('super_admin', 'school_director', 'accountant', 'bursar')
    or public.has_permission('finance.manage_refunds')
  )
)
with check (public.can_access_org(organization_id));

alter table public.approval_requests enable row level security;
alter table public.data_exports enable row level security;

create policy "tenant rw approvals" on public.approval_requests
for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

create policy "tenant rw data exports" on public.data_exports
for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

