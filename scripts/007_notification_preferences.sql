alter table public.profiles
add column if not exists notif_sound boolean default true,
add column if not exists notif_lectures boolean default true,
add column if not exists notif_attendance boolean default true;
