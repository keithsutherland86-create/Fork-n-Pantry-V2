-- Create public bucket for recipe images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- Drop existing policies first so this script is safe to re-run
drop policy if exists "Users upload own images" on storage.objects;
drop policy if exists "Users update own images" on storage.objects;
drop policy if exists "Public read recipe images" on storage.objects;

-- Allow authenticated users to upload to their own folder (userId/recipeId.ext)
create policy "Users upload own images" on storage.objects
  for insert with check (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to overwrite/update their own images
create policy "Users update own images" on storage.objects
  for update using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read for everyone (images are shown to all visitors)
create policy "Public read recipe images" on storage.objects
  for select using (bucket_id = 'recipe-images');
