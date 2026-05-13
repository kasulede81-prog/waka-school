create or replace function public.seed_demo_school_data(target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_term uuid;
  v_exam_mid uuid;
  v_exam_final uuid;
  v_exam_mock uuid;
  v_students integer;
  v_teachers integer;
begin
  v_org := target_org;
  if v_org is null then
    raise exception 'target_org is required';
  end if;

  insert into public.campuses (organization_id, name, code, is_main)
  values (v_org, 'Main Campus', 'MAIN', true)
  on conflict (organization_id, name) do nothing;

  insert into public.classes (organization_id, name, level)
  values
    (v_org, 'P5', 'primary'),
    (v_org, 'P6', 'primary'),
    (v_org, 'P7', 'primary'),
    (v_org, 'S1', 'secondary'),
    (v_org, 'S2', 'secondary')
  on conflict (organization_id, name) do nothing;

  insert into public.streams (organization_id, class_id, name)
  select v_org, c.id, s.name
  from public.classes c
  cross join (values ('North'), ('South')) as s(name)
  where c.organization_id = v_org
    and not exists (
      select 1 from public.streams st where st.organization_id = v_org and st.class_id = c.id and st.name = s.name
    );

  insert into public.academic_terms (organization_id, academic_year, name, starts_on, ends_on)
  values
    (v_org, to_char(current_date, 'YYYY'), 'Term 1', current_date - interval '90 days', current_date + interval '10 days'),
    (v_org, to_char(current_date, 'YYYY'), 'Term 2', current_date + interval '20 days', current_date + interval '110 days'),
    (v_org, to_char(current_date, 'YYYY'), 'Term 3', current_date + interval '130 days', current_date + interval '220 days')
  on conflict (organization_id, academic_year, name) do nothing;

  select id into v_term
  from public.academic_terms
  where organization_id = v_org
    and academic_year = to_char(current_date, 'YYYY')
    and name = 'Term 1'
  limit 1;

  insert into public.subjects (organization_id, code, name, level)
  values
    (v_org, 'MTC', 'Mathematics', 'core'),
    (v_org, 'ENG', 'English', 'core'),
    (v_org, 'SCI', 'Integrated Science', 'core'),
    (v_org, 'SST', 'Social Studies', 'core'),
    (v_org, 'ICT', 'Computer Studies', 'support')
  on conflict (organization_id, code) do nothing;

  insert into public.exams (organization_id, term_id, name, exam_type, weight)
  values
    (v_org, v_term, 'Mid Term', 'midterm', 30),
    (v_org, v_term, 'Final Exam', 'final', 50),
    (v_org, v_term, 'Mock', 'mock', 20)
  on conflict do nothing;

  select id into v_exam_mid from public.exams where organization_id = v_org and term_id = v_term and name = 'Mid Term' limit 1;
  select id into v_exam_final from public.exams where organization_id = v_org and term_id = v_term and name = 'Final Exam' limit 1;
  select id into v_exam_mock from public.exams where organization_id = v_org and term_id = v_term and name = 'Mock' limit 1;

  insert into public.teachers (organization_id, full_name, phone, role, salary, employment_status)
  select
    v_org,
    'Teacher ' || gs::text,
    '+2567' || lpad((10000000 + gs)::text, 8, '0'),
    'teacher',
    900000 + (gs * 15000),
    'active'
  from generate_series(1, 10) gs
  where not exists (
    select 1 from public.teachers t where t.organization_id = v_org and t.full_name = 'Teacher ' || gs::text
  );

  insert into public.parents (organization_id, full_name, phone, email, relationship)
  select
    v_org,
    'Parent ' || gs::text,
    '+2567' || lpad((20000000 + gs)::text, 8, '0'),
    'parent' || gs::text || '@demo.ug',
    'guardian'
  from generate_series(1, 50) gs
  where not exists (
    select 1 from public.parents p where p.organization_id = v_org and p.full_name = 'Parent ' || gs::text
  );

  insert into public.students (
    organization_id, full_name, gender, date_of_birth, admission_number,
    class_name, stream, parent_phone, parent_email, address, nationality, status
  )
  select
    v_org,
    'Student ' || gs::text,
    case when gs % 2 = 0 then 'female' else 'male' end,
    current_date - ((3650 + gs * 20) || ' days')::interval,
    'WAKA-' || to_char(current_date, 'YYYY') || '-' || lpad(gs::text, 4, '0'),
    (array['P5', 'P6', 'P7', 'S1', 'S2'])[1 + (gs % 5)],
    (array['North', 'South'])[1 + (gs % 2)],
    '+2567' || lpad((20000000 + gs)::text, 8, '0'),
    'parent' || gs::text || '@demo.ug',
    'Kampala',
    'Ugandan',
    'active'
  from generate_series(1, 50) gs
  where not exists (
    select 1 from public.students s where s.organization_id = v_org and s.admission_number = 'WAKA-' || to_char(current_date, 'YYYY') || '-' || lpad(gs::text, 4, '0')
  );

  insert into public.student_guardians (organization_id, student_id, parent_id, full_name, relationship, phone, email, is_primary)
  select
    v_org,
    s.id,
    p.id,
    p.full_name,
    'guardian',
    p.phone,
    p.email,
    true
  from public.students s
  join public.parents p
    on p.organization_id = v_org
   and p.full_name = replace(s.full_name, 'Student', 'Parent')
  where s.organization_id = v_org
    and not exists (
      select 1 from public.student_guardians g where g.organization_id = v_org and g.student_id = s.id and g.is_primary = true
    );

  insert into public.invoices (organization_id, student_id, total_amount, amount_paid, due_date, status)
  select
    v_org,
    s.id,
    1500000,
    case when row_number() over (order by s.id) % 3 = 0 then 1500000 else 600000 end,
    current_date + interval '14 days',
    case when row_number() over (order by s.id) % 3 = 0 then 'paid' else 'partially_paid' end
  from public.students s
  where s.organization_id = v_org
    and not exists (select 1 from public.invoices i where i.organization_id = v_org and i.student_id = s.id);

  insert into public.payments (
    organization_id, invoice_id, student_id, method, phone_number, transaction_ref,
    amount, status, paid_at, provider_name, webhook_verified
  )
  select
    v_org,
    i.id,
    i.student_id,
    case when row_number() over (order by i.id) % 2 = 0 then 'mtn_momo' else 'airtel_money' end,
    s.parent_phone,
    'demo-' || replace(i.id::text, '-', ''),
    i.amount_paid,
    'successful',
    now() - interval '2 days',
    case when row_number() over (order by i.id) % 2 = 0 then 'mtn_momo' else 'airtel_money' end,
    true
  from public.invoices i
  join public.students s on s.id = i.student_id
  where i.organization_id = v_org
    and i.amount_paid > 0
    and not exists (select 1 from public.payments p where p.organization_id = v_org and p.invoice_id = i.id);

  insert into public.attendance (organization_id, student_id, attendance_date, status, notes)
  select
    v_org,
    s.id,
    current_date - (d || ' days')::interval,
    case
      when (extract(day from s.created_at)::int + d) % 10 = 0 then 'absent'
      when (extract(day from s.created_at)::int + d) % 7 = 0 then 'late'
      else 'present'
    end,
    ''
  from public.students s
  cross join generate_series(0, 14) d
  where s.organization_id = v_org
    and not exists (
      select 1 from public.attendance a where a.organization_id = v_org and a.student_id = s.id and a.attendance_date = current_date - (d || ' days')::interval
    );

  insert into public.marks (organization_id, student_id, exam_id, subject_id, score, max_score, grade, teacher_comment)
  select
    v_org,
    s.id,
    e.id,
    subj.id,
    40 + ((abs(('x' || substr(md5(s.id::text || e.id::text || subj.id::text), 1, 8))::bit(32)::int)) % 61),
    100,
    null,
    'Keep improving'
  from public.students s
  join public.exams e on e.organization_id = v_org and e.id in (v_exam_mid, v_exam_final, v_exam_mock)
  join public.subjects subj on subj.organization_id = v_org
  where s.organization_id = v_org
    and not exists (
      select 1 from public.marks m
      where m.organization_id = v_org
        and m.student_id = s.id
        and m.exam_id = e.id
        and m.subject_id = subj.id
    );

  update public.marks
  set grade = case
    when (score / nullif(max_score, 0)) * 100 >= 80 then 'D1'
    when (score / nullif(max_score, 0)) * 100 >= 70 then 'D2'
    when (score / nullif(max_score, 0)) * 100 >= 60 then 'C3'
    when (score / nullif(max_score, 0)) * 100 >= 50 then 'C4'
    when (score / nullif(max_score, 0)) * 100 >= 40 then 'P7'
    else 'F9'
  end
  where organization_id = v_org;

  select count(*) into v_students from public.students where organization_id = v_org;
  select count(*) into v_teachers from public.teachers where organization_id = v_org;

  return jsonb_build_object(
    'organization_id', v_org,
    'students', v_students,
    'teachers', v_teachers,
    'subjects', (select count(*) from public.subjects where organization_id = v_org),
    'exams', (select count(*) from public.exams where organization_id = v_org),
    'seeded', true
  );
end;
$$;

