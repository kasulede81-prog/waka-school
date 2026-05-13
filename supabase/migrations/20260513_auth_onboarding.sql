create or replace function public.normalize_ug_phone(input_phone text)
returns text
language plpgsql
immutable
as $$
declare
  p text;
begin
  p := regexp_replace(coalesce(input_phone, ''), '\s+', '', 'g');
  if p = '' then
    return null;
  end if;
  if p ~ '^\+2567\d{8}$' then
    return p;
  end if;
  if p ~ '^2567\d{8}$' then
    return '+' || p;
  end if;
  if p ~ '^07\d{8}$' then
    return '+256' || substr(p, 2);
  end if;
  raise exception 'Invalid Uganda phone format. Use +2567XXXXXXXX or 07XXXXXXXX';
end;
$$;

create or replace function public.handle_new_user_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_super_admin_role_id uuid;
  v_full_name text;
  v_school_name text;
  v_phone text;
  v_year text;
begin
  v_full_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_school_name := trim(coalesce(new.raw_user_meta_data ->> 'school_name', ''));
  v_phone := public.normalize_ug_phone(new.raw_user_meta_data ->> 'phone');
  v_year := to_char(current_date, 'YYYY');

  if v_school_name = '' then
    raise exception 'School name is required for onboarding';
  end if;

  if v_full_name = '' then
    v_full_name := split_part(coalesce(new.email, 'User'), '@', 1);
  end if;

  if exists (
    select 1
    from public.organizations o
    where lower(trim(o.name)) = lower(v_school_name)
  ) then
    raise exception 'An organization with this name already exists';
  end if;

  insert into public.organizations (name, school_type, active_academic_year, currency, phone, email)
  values (v_school_name, 'mixed', v_year, 'UGX', v_phone, new.email)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, full_name, phone, role, is_active)
  values (new.id, v_org_id, v_full_name, v_phone, 'super_admin', true);

  insert into public.campuses (organization_id, name, code, is_main)
  values (v_org_id, 'Main Campus', 'MAIN', true);

  insert into public.roles (organization_id, code, name, is_system)
  values
    (v_org_id, 'super_admin', 'Super Admin', true),
    (v_org_id, 'admin', 'Administrator', true),
    (v_org_id, 'bursar', 'Bursar', true),
    (v_org_id, 'teacher', 'Teacher', true),
    (v_org_id, 'parent', 'Parent', true)
  on conflict (organization_id, code) do nothing;

  select r.id
  into v_super_admin_role_id
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'super_admin'
  limit 1;

  insert into public.role_permissions (organization_id, role_id, permission_id)
  select v_org_id, v_super_admin_role_id, p.id
  from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  insert into public.user_role_assignments (organization_id, user_id, role_id)
  values (v_org_id, new.id, v_super_admin_role_id)
  on conflict (organization_id, user_id, role_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_onboarding();

