-- Row Level Security policies

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.lectures enable row level security;
alter table public.attendance enable row level security;
alter table public.notifications enable row level security;
alter table public.timetable_slots enable row level security;

-- PROFILES
drop policy if exists "profiles_select_all_authed" on public.profiles;
create policy "profiles_select_all_authed"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- COURSES (read by all authed; write by faculty/admin)
drop policy if exists "courses_select_authed" on public.courses;
create policy "courses_select_authed"
  on public.courses for select
  to authenticated
  using (true);

drop policy if exists "courses_modify_faculty" on public.courses;
create policy "courses_modify_faculty"
  on public.courses for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('faculty', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('faculty', 'admin')
    )
  );

-- ENROLLMENTS
drop policy if exists "enrollments_select_authed" on public.enrollments;
create policy "enrollments_select_authed"
  on public.enrollments for select
  to authenticated
  using (true);

drop policy if exists "enrollments_modify_faculty_or_self" on public.enrollments;
create policy "enrollments_modify_faculty_or_self"
  on public.enrollments for all
  to authenticated
  using (
    student_id = auth.uid() or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  )
  with check (
    student_id = auth.uid() or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

-- LECTURES
drop policy if exists "lectures_select_authed" on public.lectures;
create policy "lectures_select_authed"
  on public.lectures for select
  to authenticated
  using (true);

drop policy if exists "lectures_modify_faculty" on public.lectures;
create policy "lectures_modify_faculty"
  on public.lectures for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

-- TIMETABLE
drop policy if exists "timetable_select_authed" on public.timetable_slots;
create policy "timetable_select_authed"
  on public.timetable_slots for select
  to authenticated
  using (true);

drop policy if exists "timetable_modify_faculty" on public.timetable_slots;
create policy "timetable_modify_faculty"
  on public.timetable_slots for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

-- ATTENDANCE
drop policy if exists "attendance_select_self_or_faculty" on public.attendance;
create policy "attendance_select_self_or_faculty"
  on public.attendance for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

drop policy if exists "attendance_insert_self_or_faculty" on public.attendance;
create policy "attendance_insert_self_or_faculty"
  on public.attendance for insert
  to authenticated
  with check (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

drop policy if exists "attendance_update_self_or_faculty" on public.attendance;
create policy "attendance_update_self_or_faculty"
  on public.attendance for update
  to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

drop policy if exists "attendance_delete_faculty" on public.attendance;
create policy "attendance_delete_faculty"
  on public.attendance for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty', 'admin'))
  );

-- NOTIFICATIONS
drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_insert_authed" on public.notifications;
create policy "notifications_insert_authed"
  on public.notifications for insert
  to authenticated
  with check (true);

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_delete_self" on public.notifications;
create policy "notifications_delete_self"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());
