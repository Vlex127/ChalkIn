-- people
create table profiles (
  id uuid primary key references auth.users,
  role text not null check (role in ('student','lecturer','admin')),
  full_name text not null,
  matric_no text unique,          -- students
  staff_no text unique            -- lecturers
);

-- academic structure
create table courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,             -- 'CSC 301'
  title text,
  semester text not null          -- '2026/2027-1'
);

create table course_lecturers (
  course_id uuid references courses,
  lecturer_id uuid references profiles,
  primary key (course_id, lecturer_id)
);

create table enrollments (
  course_id uuid references courses,
  student_id uuid references profiles,
  primary key (course_id, student_id)
);

-- one active phone per student
create table devices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles,
  device_hash text not null,
  bound_at timestamptz default now(),
  revoked_at timestamptz
);
create unique index one_active_device
  on devices (student_id) where revoked_at is null;

-- created by the lecturer's phone (ID generated client-side, offline)
create table sessions (
  id uuid primary key,            -- client-generated
  course_id uuid not null references courses,
  lecturer_id uuid not null references profiles,
  code char(6) not null,
  opened_at timestamptz not null, -- lecturer's clock
  closed_at timestamptz,
  lat double precision, lng double precision,
  received_at timestamptz default now()   -- server clock
);

-- created by student phones (ID generated client-side, offline)
create table submissions (
  id uuid primary key,            -- client-generated = idempotency key
  student_id uuid not null references profiles,
  course_id uuid not null references courses,
  device_hash text not null,
  code_entered char(6) not null,
  client_ts timestamptz not null,
  lat double precision, lng double precision, accuracy_m real,
  received_at timestamptz default now(),
  status text not null default 'pending'
    check (status in ('pending','verified','flagged','rejected','expired')),
  flag_reason text,
  session_id uuid references sessions   -- filled in by verification
);
create unique index one_per_session
  on submissions (student_id, session_id) where session_id is not null;
