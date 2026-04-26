-- Auto-create a profile row when a new auth user is created.
-- Reads role / full_name etc. from raw_user_meta_data set during sign up.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  begin
    v_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      'student'::public.user_role
    );
  exception when others then
    v_role := 'student'::public.user_role;
  end;

  insert into public.profiles (
    id, email, role, full_name, roll_no, division, year, branch,
    faculty_id, department
  ) values (
    new.id,
    new.email,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'roll_no',
    new.raw_user_meta_data ->> 'division',
    nullif(new.raw_user_meta_data ->> 'year', '')::int,
    new.raw_user_meta_data ->> 'branch',
    new.raw_user_meta_data ->> 'faculty_id',
    new.raw_user_meta_data ->> 'department'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
