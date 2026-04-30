-- Seed sample courses (faculty_id stays null until claimed by a faculty user).
-- Re-runnable via on conflict clauses.

insert into public.courses (name, code, division, year, department, total_lectures_planned, color)
values
  ('Data Structures and Algorithms', 'CS201', 'TY-CSE-A', 3, 'CSE', 60, 'chart-1'),
  ('Database Management Systems', 'CS202', 'TY-CSE-A', 3, 'CSE', 55, 'chart-2'),
  ('Operating Systems', 'CS203', 'TY-CSE-A', 3, 'CSE', 60, 'chart-3'),
  ('Computer Networks', 'CS204', 'TY-CSE-A', 3, 'CSE', 50, 'chart-4'),
  ('Theory of Computation', 'CS205', 'TY-CSE-A', 3, 'CSE', 50, 'chart-5'),
  ('Software Engineering', 'CS206', 'TY-CSE-A', 3, 'CSE', 45, 'chart-1')
on conflict (code) do nothing;

-- Seed weekly timetable for TY-CSE-A
do $$
declare
  c_dsa uuid := (select id from public.courses where code = 'CS201');
  c_dbms uuid := (select id from public.courses where code = 'CS202');
  c_os uuid := (select id from public.courses where code = 'CS203');
  c_cn uuid := (select id from public.courses where code = 'CS204');
  c_toc uuid := (select id from public.courses where code = 'CS205');
  c_se uuid := (select id from public.courses where code = 'CS206');
begin
  -- Clear and reseed timetable for these courses to keep idempotent
  delete from public.timetable_slots where course_id in (c_dsa, c_dbms, c_os, c_cn, c_toc, c_se);

  -- Monday (1)
  insert into public.timetable_slots (course_id, day_of_week, start_time, end_time, room) values
    (c_dsa, 1, '09:00', '10:00', 'A-101'),
    (c_dbms, 1, '10:15', '11:15', 'A-101'),
    (c_os, 1, '11:30', '12:30', 'A-101'),
    (c_cn, 1, '14:00', '15:00', 'A-101');
  -- Tuesday (2)
  insert into public.timetable_slots (course_id, day_of_week, start_time, end_time, room) values
    (c_toc, 2, '09:00', '10:00', 'A-102'),
    (c_se, 2, '10:15', '11:15', 'A-102'),
    (c_dsa, 2, '11:30', '12:30', 'A-102'),
    (c_dbms, 2, '14:00', '15:00', 'A-102');
  -- Wednesday (3)
  insert into public.timetable_slots (course_id, day_of_week, start_time, end_time, room) values
    (c_os, 3, '09:00', '10:00', 'A-101'),
    (c_cn, 3, '10:15', '11:15', 'A-101'),
    (c_toc, 3, '11:30', '12:30', 'A-101');
  -- Thursday (4)
  insert into public.timetable_slots (course_id, day_of_week, start_time, end_time, room) values
    (c_se, 4, '09:00', '10:00', 'A-103'),
    (c_dsa, 4, '10:15', '11:15', 'A-103'),
    (c_dbms, 4, '11:30', '12:30', 'A-103'),
    (c_os, 4, '14:00', '15:00', 'A-103');
  -- Friday (5)
  insert into public.timetable_slots (course_id, day_of_week, start_time, end_time, room) values
    (c_cn, 5, '09:00', '10:00', 'A-104'),
    (c_toc, 5, '10:15', '11:15', 'A-104'),
    (c_se, 5, '11:30', '12:30', 'A-104');
end $$;
