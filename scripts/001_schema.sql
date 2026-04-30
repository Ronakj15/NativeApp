-- Attendance Management System schema
-- Drop existing types/tables for clean re-runs (safe with IF EXISTS)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'faculty', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'lecture_status') then
    create type public.lecture_status as enum ('scheduled', 'live', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_method') then
    create type public.attendance_method as enum ('beacon_face', 'manual', 'qr', 'face_only');
  end if;
end $$;

-- Profiles: extends auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text not null default '',
  email text not null default '',
  -- student fields
  roll_no text,
  division text,
  year integer,
  department text,
  -- faculty fields
  faculty_id text,
  -- shared
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  faculty_id uuid references public.profiles(id) on delete set null,
  division text,
  year integer,
  department text,
  total_lectures_planned integer not null default 60,
  color text default 'chart-1',
  created_at timestamptz not null default now()
);

create unique index if not exists courses_code_unique on public.courses(code);

-- Enrollments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

-- Lectures (single sessions)
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  faculty_id uuid references public.profiles(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  room text,
  beacon_id text,
  topic text,
  status public.lecture_status not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lectures_course_idx on public.lectures(course_id);
create index if not exists lectures_status_idx on public.lectures(status);
create index if not exists lectures_start_idx on public.lectures(scheduled_start);

-- Attendance
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'absent',
  method public.attendance_method,
  marked_at timestamptz,
  confidence numeric,
  notes text,
  unique (lecture_id, student_id)
);

create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists attendance_lecture_idx on public.attendance(lecture_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read);

-- Timetable (weekly recurring schedule)
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text
);
