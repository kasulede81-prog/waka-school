-- Wave 3: class attendance sessions, staff QR check-in, parent–student portal links,
-- fee charge lines (Uganda-style multi-category billing), parent RLS hardening.

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_parent_user()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'parent'::public.school_role
  );
$$;

-- ---------------------------------------------------------------------------
-- Organizations: staff day start (Kampala-local comparison in RPC)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists staff_day_start_time time not null default time '08:00';

-- ---------------------------------------------------------------------------
-- Student attendance: extended statuses + session support
-- ---------------------------------------------------------------------------
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'absent', 'late', 'sick', 'excused'));

alter table public.attendance drop constraint if exists attendance_student_id_attendance_date_key;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_name text not null,
  stream text,
  session_date date not null,
  public_token uuid not null default gen_random_uuid(),
  opened_by uuid references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (public_token)
);

create index if not exists idx_attendance_sessions_org_date on public.attendance_sessions (organization_id, session_date);

alter table public.attendance
  add column if not exists session_id uuid references public.attendance_sessions(id) on delete cascade;

create unique index if not exists uq_attendance_student_date_legacy
  on public.attendance (student_id, attendance_date)
  where session_id is null;

create unique index if not exists uq_attendance_student_session
  on public.attendance (student_id, session_id)
  where session_id is not null;

alter table public.attendance_sessions enable row level security;

create policy "tenant rw attendance_sessions"
  on public.attendance_sessions
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- ---------------------------------------------------------------------------
-- Teacher attendance: QR metadata
-- ---------------------------------------------------------------------------
alter table public.teacher_attendance
  add column if not exists check_in_at timestamptz,
  add column if not exists campus_id uuid references public.campuses(id) on delete set null,
  add column if not exists device_info text,
  add column if not exists check_source text not null default 'manual';

alter table public.teacher_attendance drop constraint if exists teacher_attendance_check_source_check;
alter table public.teacher_attendance
  add constraint teacher_attendance_check_source_check
  check (check_source in ('manual', 'qr'));

-- ---------------------------------------------------------------------------
-- Staff QR secrets (one row per teacher)
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_attendance_qr (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  secret_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (teacher_id),
  unique (secret_token)
);

create index if not exists idx_teacher_attendance_qr_org on public.teacher_attendance_qr (organization_id);

alter table public.teacher_attendance_qr enable row level security;

create policy "tenant rw teacher_attendance_qr"
  on public.teacher_attendance_qr
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

insert into public.teacher_attendance_qr (organization_id, teacher_id)
select t.organization_id, t.id
from public.teachers t
where not exists (select 1 from public.teacher_attendance_qr q where q.teacher_id = t.id);

create or replace function public.ensure_teacher_attendance_qr_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teacher_attendance_qr (organization_id, teacher_id)
  values (new.organization_id, new.id)
  on conflict (teacher_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_teachers_qr on public.teachers;
create trigger trg_teachers_qr
  after insert on public.teachers
  for each row execute function public.ensure_teacher_attendance_qr_row();

-- ---------------------------------------------------------------------------
-- Portal links: auth profile <-> student (multiple guardians supported)
-- ---------------------------------------------------------------------------
create table if not exists public.parent_guardian_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, student_id)
);

create index if not exists idx_parent_guardian_links_student on public.parent_guardian_links (student_id);
create index if not exists idx_parent_guardian_links_parent on public.parent_guardian_links (parent_profile_id);

alter table public.parent_guardian_links enable row level security;

create policy "tenant rw parent_guardian_links"
  on public.parent_guardian_links
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

create policy "parent read own guardian links"
  on public.parent_guardian_links
  for select
  using (parent_profile_id = auth.uid());

create policy parent_guardian_links_select_scope on public.parent_guardian_links
  as restrictive for select to authenticated
  using (not public.is_parent_user() or parent_profile_id = auth.uid());

create policy parent_guardian_links_no_write on public.parent_guardian_links
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy parent_guardian_links_no_update on public.parent_guardian_links
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy parent_guardian_links_no_delete on public.parent_guardian_links
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create or replace function public.is_linked_parent(p_student_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.parent_guardian_links g
    where g.student_id = p_student_id and g.parent_profile_id = auth.uid()
  );
$$;

-- Auto-link parents when phone matches student.parent_phone (normalized digits)
create or replace function public.trg_sync_parent_guardian_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
begin
  if new.role is distinct from 'parent'::public.school_role then
    return new;
  end if;
  if new.organization_id is null or new.phone is null then
    return new;
  end if;
  norm := regexp_replace(new.phone, '\D', '', 'g');
  if norm = '' then
    return new;
  end if;
  insert into public.parent_guardian_links (organization_id, parent_profile_id, student_id, relationship, is_primary)
  select new.organization_id, new.id, s.id, 'guardian', true
  from public.students s
  where s.organization_id = new.organization_id
    and regexp_replace(coalesce(s.parent_phone, ''), '\D', '', 'g') = norm
  on conflict (parent_profile_id, student_id) do nothing;
  return new;
end;
$$;

create or replace function public.trg_sync_parent_guardian_from_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
begin
  if new.parent_phone is null then
    return new;
  end if;
  norm := regexp_replace(new.parent_phone, '\D', '', 'g');
  if norm = '' then
    return new;
  end if;
  insert into public.parent_guardian_links (organization_id, parent_profile_id, student_id, relationship, is_primary)
  select new.organization_id, p.id, new.id, 'guardian', true
  from public.profiles p
  where p.organization_id = new.organization_id
    and p.role = 'parent'::public.school_role
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = norm
  on conflict (parent_profile_id, student_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profile_parent_guardian on public.profiles;
create trigger trg_profile_parent_guardian
  after insert or update of phone, role, organization_id on public.profiles
  for each row execute function public.trg_sync_parent_guardian_from_profile();

drop trigger if exists trg_student_parent_guardian on public.students;
create trigger trg_student_parent_guardian
  after insert or update of parent_phone, organization_id on public.students
  for each row execute function public.trg_sync_parent_guardian_from_student();

-- ---------------------------------------------------------------------------
-- Per-category fee lines (billed / paid / balance)
-- ---------------------------------------------------------------------------
create table if not exists public.fee_charge_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_category text not null,
  academic_year text not null,
  term text not null,
  amount_billed numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  balance numeric(14,2) generated always as (amount_billed - amount_paid) stored,
  due_date date,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_charge_lines_org_student on public.fee_charge_lines (organization_id, student_id);

alter table public.fee_charge_lines enable row level security;

create policy "tenant rw fee_charge_lines"
  on public.fee_charge_lines
  for all
  using (public.can_access_org(organization_id))
  with check (public.can_access_org(organization_id));

-- Broader fee catalog on master fee structures
alter table public.fees drop constraint if exists fees_category_check;
alter table public.fees
  add constraint fees_category_check check (
    category in (
      'tuition', 'transport', 'boarding', 'meals', 'uniforms', 'uniform', 'exams', 'exam', 'development',
      'library', 'computer', 'trips', 'trip', 'activity', 'medical', 'registration', 'lunch', 'uneb', 'custom', 'other'
    )
  );

-- ---------------------------------------------------------------------------
-- Parent isolation (restrictive) — defense in depth vs tenant-wide org policies
-- ---------------------------------------------------------------------------
create policy student_parent_select_scope on public.students
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(id));

create policy student_parent_no_insert on public.students
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy student_parent_no_update on public.students
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy student_parent_no_delete on public.students
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy parent_deny_teachers on public.teachers
  as restrictive for select to authenticated
  using (not public.is_parent_user());

create policy parent_deny_teacher_attendance on public.teacher_attendance
  as restrictive for select to authenticated
  using (not public.is_parent_user());

create policy parent_deny_teacher_qr on public.teacher_attendance_qr
  as restrictive for select to authenticated
  using (not public.is_parent_user());

create policy parent_deny_attendance_sessions on public.attendance_sessions
  as restrictive for select to authenticated
  using (not public.is_parent_user());

create policy attendance_parent_select on public.attendance
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy attendance_parent_no_insert on public.attendance
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy attendance_parent_no_update on public.attendance
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy attendance_parent_no_delete on public.attendance
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy invoices_parent_select on public.invoices
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy invoices_parent_no_insert on public.invoices
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy invoices_parent_no_update on public.invoices
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy invoices_parent_no_delete on public.invoices
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy payments_parent_select on public.payments
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy payments_parent_no_insert on public.payments
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy payments_parent_no_update on public.payments
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy payments_parent_no_delete on public.payments
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy report_cards_parent_select on public.report_cards
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy report_cards_parent_no_insert on public.report_cards
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy report_cards_parent_no_update on public.report_cards
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy report_cards_parent_no_delete on public.report_cards
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy marks_parent_select on public.marks
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy marks_parent_no_insert on public.marks
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy marks_parent_no_update on public.marks
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy marks_parent_no_delete on public.marks
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy fee_lines_parent_select on public.fee_charge_lines
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy fee_lines_parent_no_insert on public.fee_charge_lines
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy fee_lines_parent_no_update on public.fee_charge_lines
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy fee_lines_parent_no_delete on public.fee_charge_lines
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

create policy student_docs_parent_select on public.student_documents
  as restrictive for select to authenticated
  using (not public.is_parent_user() or public.is_linked_parent(student_id));

create policy student_docs_parent_no_insert on public.student_documents
  as restrictive for insert to authenticated
  with check (not public.is_parent_user());

create policy student_docs_parent_no_update on public.student_documents
  as restrictive for update to authenticated
  using (not public.is_parent_user())
  with check (not public.is_parent_user());

create policy student_docs_parent_no_delete on public.student_documents
  as restrictive for delete to authenticated
  using (not public.is_parent_user());

-- ---------------------------------------------------------------------------
-- RPC: anonymous / kiosk staff check-in via QR secret
-- ---------------------------------------------------------------------------
create or replace function public.record_staff_qr_check_in(
  p_secret uuid,
  p_campus_id uuid,
  p_device text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_org_id uuid;
  v_name text;
  v_today date;
  v_start time;
  v_late boolean;
  v_existing uuid;
begin
  if p_secret is null then
    return jsonb_build_object('ok', false, 'error', 'missing_token');
  end if;

  select t.id, t.organization_id, t.full_name
    into v_teacher_id, v_org_id, v_name
  from public.teacher_attendance_qr q
  join public.teachers t on t.id = q.teacher_id
  where q.secret_token = p_secret;

  if v_teacher_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_today := (timezone('Africa/Kampala', clock_timestamp()))::date;

  select id into v_existing
  from public.teacher_attendance
  where teacher_id = v_teacher_id and attendance_date = v_today;

  if v_existing is not null then
    return jsonb_build_object('ok', false, 'error', 'already_checked_in', 'teacher_name', v_name);
  end if;

  select coalesce(o.staff_day_start_time, time '08:00')
    into v_start
  from public.organizations o
  where o.id = v_org_id;

  v_late := (timezone('Africa/Kampala', clock_timestamp()))::time > v_start;

  insert into public.teacher_attendance (
    organization_id,
    teacher_id,
    attendance_date,
    status,
    notes,
    check_in_at,
    campus_id,
    device_info,
    check_source
  )
  values (
    v_org_id,
    v_teacher_id,
    v_today,
    case when v_late then 'late' else 'present' end,
    'QR kiosk check-in',
    clock_timestamp(),
    p_campus_id,
    coalesce(p_device, ''),
    'qr'
  );

  return jsonb_build_object(
    'ok', true,
    'teacher_name', v_name,
    'status', case when v_late then 'late' else 'present' end,
    'check_in_date', v_today
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_checked_in', 'teacher_name', v_name);
end;
$$;

grant execute on function public.record_staff_qr_check_in(uuid, uuid, text) to anon;
grant execute on function public.record_staff_qr_check_in(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: rotate QR secret (staff with org access)
-- ---------------------------------------------------------------------------
create or replace function public.rotate_teacher_attendance_qr(p_teacher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_new uuid := gen_random_uuid();
begin
  select organization_id into v_org from public.teachers where id = p_teacher_id;
  if v_org is null then
    raise exception 'Teacher not found';
  end if;
  if not public.can_access_org(v_org) then
    raise exception 'Forbidden';
  end if;

  insert into public.teacher_attendance_qr (organization_id, teacher_id, secret_token)
  values (v_org, p_teacher_id, v_new)
  on conflict (teacher_id) do update
  set secret_token = excluded.secret_token, created_at = now();

  return v_new;
end;
$$;

grant execute on function public.rotate_teacher_attendance_qr(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: resolve class session token (logged-in staff of same org)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_attendance_session_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'organization_id', s.organization_id,
    'class_name', s.class_name,
    'stream', s.stream,
    'session_date', s.session_date
  )
  into r
  from public.attendance_sessions s
  join public.profiles p on p.organization_id = s.organization_id and p.id = auth.uid()
  where s.public_token = p_token
    and (s.expires_at is null or s.expires_at > now())
    and p.role::text not in ('parent', 'student')
  limit 1;

  return coalesce(r, jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token'));
end;
$$;

grant execute on function public.resolve_attendance_session_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: bulk save class register for a session
-- ---------------------------------------------------------------------------
create or replace function public.save_class_attendance_register(p_session_id uuid, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.attendance_sessions%rowtype;
  e jsonb;
  stid uuid;
  st text;
  applied integer := 0;
begin
  select * into sess from public.attendance_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = sess.organization_id
      and p.role::text not in ('parent', 'student')
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    stid := (e ->> 'student_id')::uuid;
    st := e ->> 'status';
    if st is null or st not in ('present', 'absent', 'late', 'sick', 'excused') then
      continue;
    end if;
    if not exists (
      select 1 from public.students s
      where s.id = stid
        and s.organization_id = sess.organization_id
        and s.class_name = sess.class_name
        and (
          sess.stream is null
          or sess.stream = ''
          or coalesce(s.stream, '') = sess.stream
        )
    ) then
      continue;
    end if;

    insert into public.attendance (
      organization_id,
      student_id,
      attendance_date,
      status,
      notes,
      session_id,
      created_by
    )
    values (
      sess.organization_id,
      stid,
      sess.session_date,
      st,
      coalesce(e ->> 'notes', ''),
      p_session_id,
      auth.uid()
    )
    on conflict (student_id, session_id) where session_id is not null
    do update set
      status = excluded.status,
      notes = excluded.notes,
      created_by = auth.uid();

    applied := applied + 1;
  end loop;

  return jsonb_build_object('ok', true, 'applied', applied);
end;
$$;

grant execute on function public.save_class_attendance_register(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: kiosk context (campuses) after QR secret validated — anon-safe metadata
-- ---------------------------------------------------------------------------
create or replace function public.get_staff_qr_kiosk_context(p_secret uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'ok', true,
    'organization_id', q.organization_id,
    'teacher_name', t.full_name,
    'campuses', coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code) order by c.name)
        from public.campuses c
        where c.organization_id = q.organization_id
      ),
      '[]'::jsonb
    )
  )
  into r
  from public.teacher_attendance_qr q
  join public.teachers t on t.id = q.teacher_id
  where q.secret_token = p_secret
  limit 1;

  return coalesce(r, jsonb_build_object('ok', false, 'error', 'invalid_token'));
end;
$$;

grant execute on function public.get_staff_qr_kiosk_context(uuid) to anon;
grant execute on function public.get_staff_qr_kiosk_context(uuid) to authenticated;
