create table if not exists public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  notes text,
  created_at timestamptz not null default now(),
  unique (teacher_id, attendance_date)
);

create index if not exists idx_teacher_attendance_org_date on public.teacher_attendance (organization_id, attendance_date);

alter table public.teacher_attendance enable row level security;

drop policy if exists "tenant rw teacher attendance" on public.teacher_attendance;

create policy "tenant rw teacher attendance"
on public.teacher_attendance
for all
using (public.can_access_org(organization_id))
with check (public.can_access_org(organization_id));

