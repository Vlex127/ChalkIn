-- ChalkIn: initial schema, RLS, and server functions
-- Put this at supabase/migrations/0001_init.sql (or paste into the SQL editor).
--
-- Design rules:
--  * Clients (anon / authenticated) can READ what RLS allows and call a few RPCs.
--  * Clients can NOT insert or update submissions or sessions directly.
--    Those go through /api/sync, which verifies the device signature and then
--    calls the server-only ingest_* functions with the service role key.

create extension if not exists pgcrypto;

-- =====================================================================
-- TABLES
-- =====================================================================

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        text not null check (role in ('student','lecturer','admin')),
  full_name   text not null default '',
  matric_no   text unique,
  staff_no    text unique,
  approved    boolean not null default false,   -- lecturers start false
  created_at  timestamptz not null default now()
);

create table public.courses (
  id        uuid primary key default gen_random_uuid(),
  code      text not null,                      -- 'CSC 301'
  title     text,
  semester  text not null                       -- '2026/2027-1'
);

create table public.course_lecturers (
  course_id   uuid not null references public.courses on delete cascade,
  lecturer_id uuid not null references public.profiles on delete cascade,
  primary key (course_id, lecturer_id)
);

-- Class list keyed by matric number (students may not have signed up yet
-- when the lecturer uploads the CSV).
create table public.enrollments (
  course_id  uuid not null references public.courses on delete cascade,
  matric_no  text not null,
  full_name  text,
  primary key (course_id, matric_no)
);

-- One active device per user. public_key is a WebCrypto ECDSA P-256 JWK.
create table public.devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  public_key  jsonb not null,
  label       text,
  bound_at    timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index one_active_device
  on public.devices (user_id) where revoked_at is null;

-- Created on the lecturer's phone (id generated client-side, offline).
create table public.sessions (
  id           uuid primary key,
  course_id    uuid not null references public.courses on delete cascade,
  lecturer_id  uuid not null references public.profiles,
  device_id    uuid not null references public.devices,
  code         text not null check (code ~ '^[0-9]{6}$'),
  opened_at    timestamptz not null,            -- lecturer's clock
  closed_at    timestamptz,
  lat          double precision,
  lng          double precision,
  received_at  timestamptz not null default now(),   -- server clock
  check (closed_at is null or closed_at >= opened_at)
);
create index sessions_course_code on public.sessions (course_id, code);

-- Created on student phones (id generated client-side, offline).
create table public.submissions (
  id            uuid primary key,
  student_id    uuid not null references public.profiles,
  course_id     uuid not null references public.courses on delete cascade,
  device_id     uuid not null references public.devices,
  code_entered  text not null check (code_entered ~ '^[0-9]{6}$'),
  client_ts     timestamptz not null,
  lat           double precision,
  lng           double precision,
  accuracy_m    real,
  received_at   timestamptz not null default now(),
  status        text not null default 'pending'
                check (status in ('pending','verified','flagged','rejected','expired')),
  flag_reason   text,
  session_id    uuid references public.sessions
);
create unique index one_per_session
  on public.submissions (student_id, session_id) where session_id is not null;
create index submissions_course_status on public.submissions (course_id, status);

-- =====================================================================
-- NEW USER -> PROFILE
-- Role comes from signup metadata, which the user controls, so only
-- 'student' and 'lecturer' are accepted and lecturers always start unapproved.
-- Admins are created by hand.
-- =====================================================================

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if r not in ('student','lecturer') then r := 'student'; end if;

  insert into public.profiles (id, role, full_name, matric_no, staff_no, approved)
  values (
    new.id,
    r,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when r = 'student'  then nullif(upper(trim(new.raw_user_meta_data->>'matric_no')), '') end,
    case when r = 'lecturer' then nullif(trim(new.raw_user_meta_data->>'staff_no'), '') end,
    (r = 'student')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS HELPERS (security definer so policies don't recurse into each other)
-- =====================================================================

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role = 'admin' and approved);
$$;

create function public.teaches(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1
                 from course_lecturers cl
                 join profiles p on p.id = cl.lecturer_id
                 where cl.course_id = p_course
                   and cl.lecturer_id = auth.uid()
                   and p.approved);
$$;

create function public.my_matric() returns text
language sql stable security definer set search_path = public as $$
  select matric_no from profiles where id = auth.uid();
$$;

create function public.teaches_matric(p_matric text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments e
                 where e.matric_no = p_matric and public.teaches(e.course_id));
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- No insert/update/delete policies exist on purpose: every write goes
-- through a security definer function or the service role.
-- =====================================================================

alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.course_lecturers enable row level security;
alter table public.enrollments      enable row level security;
alter table public.devices          enable row level security;
alter table public.sessions         enable row level security;
alter table public.submissions      enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (role = 'student' and public.teaches_matric(matric_no))
  );

create policy courses_read on public.courses for select to authenticated
  using (
    public.is_admin()
    or public.teaches(id)
    or exists (select 1 from public.enrollments e
               where e.course_id = courses.id and e.matric_no = public.my_matric())
  );

create policy course_lecturers_read on public.course_lecturers for select to authenticated
  using (lecturer_id = auth.uid() or public.is_admin());

create policy enrollments_read on public.enrollments for select to authenticated
  using (
    public.is_admin()
    or public.teaches(course_id)
    or matric_no = public.my_matric()
  );

create policy devices_read on public.devices for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Students must never read sessions: the code lives there.
create policy sessions_read on public.sessions for select to authenticated
  using (public.is_admin() or public.teaches(course_id));

create policy submissions_read on public.submissions for select to authenticated
  using (
    student_id = auth.uid()
    or public.teaches(course_id)
    or public.is_admin()
  );

-- Defense in depth on top of RLS.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke insert, update, delete on tables from authenticated;

-- =====================================================================
-- VERIFICATION (server-only)
-- Signature checking happens in /api/sync before anything reaches here.
-- A submission with no matching session yet stays 'pending'.
-- =====================================================================

create function public.verify_submission(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s        submissions%rowtype;
  sess     sessions%rowtype;
  v_dist   double precision;
  v_status text := 'verified';
  v_reason text;
begin
  select * into s from submissions where id = p_id and status = 'pending' for update;
  if not found then return; end if;

  -- Student must sync within 48 hours of submitting.
  if s.received_at - s.client_ts > interval '48 hours' then
    update submissions
       set status = 'expired', flag_reason = 'Not synced within 48 hours'
     where id = p_id;
    return;
  end if;

  -- Match on course + code + time window (2 min slack for clock drift).
  select * into sess from sessions
   where course_id = s.course_id
     and code = s.code_entered
     and s.client_ts >= opened_at - interval '2 minutes'
     and s.client_ts <= coalesce(closed_at, opened_at + interval '15 minutes') + interval '2 minutes'
   order by opened_at desc
   limit 1;
  if not found then return; end if;   -- wait for the lecturer's session to sync

  if not exists (select 1 from profiles p
                 join enrollments e on e.matric_no = p.matric_no
                 where p.id = s.student_id and e.course_id = s.course_id) then
    update submissions
       set status = 'rejected', flag_reason = 'Not on the class list'
     where id = p_id;
    return;
  end if;

  if s.client_ts > s.received_at + interval '5 minutes' then
    v_status := 'flagged'; v_reason := 'Phone clock is ahead of real time';
  elsif s.lat is null or sess.lat is null then
    v_status := 'flagged'; v_reason := 'No location available';
  else
    v_dist := 2 * 6371000 * asin(sqrt(
        power(sin(radians(s.lat - sess.lat) / 2), 2)
      + cos(radians(sess.lat)) * cos(radians(s.lat))
        * power(sin(radians(s.lng - sess.lng) / 2), 2)));
    if v_dist > 150 + coalesce(s.accuracy_m, 0) then
      v_status := 'flagged';
      v_reason := format('Location about %s m from class', round(v_dist));
    end if;
  end if;

  begin
    update submissions
       set session_id = sess.id, status = v_status, flag_reason = v_reason
     where id = p_id;
  exception when unique_violation then
    update submissions
       set status = 'rejected', flag_reason = 'Duplicate submission'
     where id = p_id;
  end;
end $$;

-- Student batch. Idempotent: re-sending the same id does nothing.
create function public.ingest_submissions(p_user uuid, p_device uuid, p_items jsonb)
returns table (sub_id uuid, sub_status text, sub_reason text, sub_session uuid)
language plpgsql security definer set search_path = public as $$
declare
  it   jsonb;
  v_id uuid;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_id := (it->>'id')::uuid;

    insert into submissions
      (id, student_id, course_id, device_id, code_entered, client_ts, lat, lng, accuracy_m)
    values
      (v_id, p_user, (it->>'courseId')::uuid, p_device, it->>'codeEntered',
       (it->>'clientTs')::timestamptz,
       (it->>'lat')::double precision, (it->>'lng')::double precision,
       (it->>'accuracyM')::real)
    on conflict (id) do nothing;

    perform public.verify_submission(v_id);
  end loop;

  return query
    select s.id, s.status, s.flag_reason, s.session_id
      from submissions s
     where s.student_id = p_user
       and s.id in (select (x->>'id')::uuid from jsonb_array_elements(p_items) x);
end $$;

-- Lecturer batch. Re-sending updates closed_at only, for the owner's own session.
create function public.ingest_sessions(p_user uuid, p_device uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  it       jsonb;
  v_course uuid;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_course := (it->>'courseId')::uuid;

    if not exists (select 1 from course_lecturers cl
                   join profiles p on p.id = cl.lecturer_id
                   where cl.course_id = v_course
                     and cl.lecturer_id = p_user and p.approved) then
      raise exception 'not_allowed';
    end if;

    insert into sessions
      (id, course_id, lecturer_id, device_id, code, opened_at, closed_at, lat, lng)
    values
      ((it->>'id')::uuid, v_course, p_user, p_device, it->>'code',
       (it->>'openedAt')::timestamptz, (it->>'closedAt')::timestamptz,
       (it->>'lat')::double precision, (it->>'lng')::double precision)
    on conflict (id) do update
      set closed_at = excluded.closed_at
      where sessions.lecturer_id = p_user;

    -- Anything waiting for this session can now be matched.
    perform public.verify_submission(s.id)
       from submissions s
      where s.course_id = v_course and s.status = 'pending';
  end loop;
end $$;

-- Run on a schedule (pg_cron): pending for a week with no session = wrong code.
create function public.sweep_pending() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update submissions
     set status = 'rejected', flag_reason = 'No matching session found'
   where status = 'pending' and received_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
-- select cron.schedule('chalkin-sweep', '0 3 * * *', 'select public.sweep_pending()');

-- =====================================================================
-- CLIENT-CALLABLE RPCs (authenticated users)
-- =====================================================================

create function public.bind_device(p_public_key jsonb, p_label text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and approved) then
    raise exception 'not_approved';
  end if;
  insert into devices (user_id, public_key, label)
  values (auth.uid(), p_public_key, p_label)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'already_bound';
end $$;

create function public.create_course(p_code text, p_title text, p_semester text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from profiles
                 where id = auth.uid() and role = 'lecturer' and approved) then
    raise exception 'not_approved';
  end if;
  insert into courses (code, title, semester)
  values (trim(p_code), p_title, p_semester) returning id into v_id;
  insert into course_lecturers (course_id, lecturer_id) values (v_id, auth.uid());
  return v_id;
end $$;

-- p_rows: [{"matric_no": "...", "full_name": "..."}]
create function public.import_roster(p_course uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.teaches(p_course) then raise exception 'not_allowed'; end if;

  insert into enrollments (course_id, matric_no, full_name)
  select p_course, upper(trim(r->>'matric_no')), r->>'full_name'
    from jsonb_array_elements(p_rows) r
   where coalesce(trim(r->>'matric_no'), '') <> ''
  on conflict (course_id, matric_no) do update set full_name = excluded.full_name;

  get diagnostics n = row_count;
  return n;
end $$;

-- Lecturer resolves a flagged submission.
create function public.review_submission(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  if p_status not in ('verified','rejected') then raise exception 'bad_status'; end if;
  select course_id into v_course from submissions where id = p_id and status = 'flagged';
  if v_course is null or not public.teaches(v_course) then
    raise exception 'not_allowed';
  end if;
  update submissions set status = p_status,
         flag_reason = flag_reason || ' (reviewed by lecturer)'
   where id = p_id;
end $$;

-- Lecturer (or admin) approves a student's request for a new phone.
create function public.revoke_student_device(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_matric text;
begin
  select matric_no into v_matric from profiles where id = p_student;
  if not (public.is_admin() or public.teaches_matric(v_matric)) then
    raise exception 'not_allowed';
  end if;
  update devices set revoked_at = now()
   where user_id = p_student and revoked_at is null;
end $$;

-- Student's own numbers. Students can't read sessions, so this counts for them.
-- total_sessions only includes sessions the lecturer has already synced.
create function public.my_attendance()
returns table (course_id uuid, course_code text, course_title text,
               total_sessions bigint, attended bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.title,
         (select count(*) from sessions s where s.course_id = c.id),
         (select count(*) from submissions x
           where x.student_id = auth.uid() and x.course_id = c.id and x.status = 'verified')
    from courses c
    join enrollments e on e.course_id = c.id
   where e.matric_no = (select matric_no from profiles where id = auth.uid());
$$;

-- Lecturer view. security_invoker means RLS still applies to whoever queries it.
create view public.attendance_summary with (security_invoker = true) as
select e.course_id, e.matric_no, e.full_name, p.id as student_id,
       (select count(*) from sessions s where s.course_id = e.course_id) as total_sessions,
       (select count(*) from submissions x
         where x.student_id = p.id and x.course_id = e.course_id
           and x.status = 'verified') as attended
  from enrollments e
  left join profiles p on p.matric_no = e.matric_no;

grant select on public.attendance_summary to authenticated;

-- =====================================================================
-- FUNCTION PERMISSIONS
-- =====================================================================

-- Server-only: service role (used by /api/sync and cron) and nobody else.
revoke all on function public.verify_submission(uuid)                 from public, anon, authenticated;
revoke all on function public.ingest_submissions(uuid, uuid, jsonb)  from public, anon, authenticated;
revoke all on function public.ingest_sessions(uuid, uuid, jsonb)     from public, anon, authenticated;
revoke all on function public.sweep_pending()                        from public, anon, authenticated;
grant execute on function public.verify_submission(uuid)                to service_role;
grant execute on function public.ingest_submissions(uuid, uuid, jsonb)  to service_role;
grant execute on function public.ingest_sessions(uuid, uuid, jsonb)     to service_role;
grant execute on function public.sweep_pending()                        to service_role;

-- Signed-in users only.
revoke execute on function public.bind_device(jsonb, text)            from public, anon;
revoke execute on function public.create_course(text, text, text)     from public, anon;
revoke execute on function public.import_roster(uuid, jsonb)          from public, anon;
revoke execute on function public.review_submission(uuid, text)       from public, anon;
revoke execute on function public.revoke_student_device(uuid)         from public, anon;
revoke execute on function public.my_attendance()                     from public, anon;
grant execute on function public.bind_device(jsonb, text)             to authenticated;
grant execute on function public.create_course(text, text, text)      to authenticated;
grant execute on function public.import_roster(uuid, jsonb)           to authenticated;
grant execute on function public.review_submission(uuid, text)        to authenticated;
grant execute on function public.revoke_student_device(uuid)          to authenticated;
grant execute on function public.my_attendance()                      to authenticated;
