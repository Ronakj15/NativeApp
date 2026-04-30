-- Create 'avatars' storage bucket if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true) 
on conflict (id) do nothing;

-- Set up access controls for the 'avatars' bucket

-- 1. Allow public read access to all avatars
create policy "Avatar images are publicly accessible." 
on storage.objects for select 
using ( bucket_id = 'avatars' );

-- 2. Allow authenticated users to upload new avatars
create policy "Anyone can upload an avatar." 
on storage.objects for insert 
with check ( bucket_id = 'avatars' );

-- 3. Allow users to update their own avatars
create policy "Users can update their own avatars." 
on storage.objects for update 
using ( bucket_id = 'avatars' AND owner_id = auth.uid()::text );

-- 4. Allow users to delete their own avatars
create policy "Users can delete their own avatars." 
on storage.objects for delete 
using ( bucket_id = 'avatars' AND owner_id = auth.uid()::text );
