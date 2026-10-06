-- Run once in Supabase → SQL Editor: chat attachments (images, videos, files)
alter table messages add column if not exists file_path text;
alter table messages add column if not exists file_name text;
alter table messages add column if not exists file_type text;
alter table messages add column if not exists file_size bigint;
alter table messages drop constraint if exists messages_body_check;
alter table messages add constraint messages_body_check
  check (length(body)<=2000 and (length(body)>0 or file_path is not null));

-- private bucket, 25 MB per file; only the two people in a chat can upload or open files
insert into storage.buckets(id,name,public,file_size_limit) values('chat-files','chat-files',false,26214400)
  on conflict (id) do nothing;
create policy "chat upload" on storage.objects for insert to authenticated
  with check(bucket_id='chat-files' and is_verified() and exists(
    select 1 from threads t where t.id::text=(storage.foldername(name))[1] and auth.uid() in (t.owner,t.buyer)));
create policy "chat read" on storage.objects for select to authenticated
  using(bucket_id='chat-files' and exists(
    select 1 from threads t where t.id::text=(storage.foldername(name))[1] and auth.uid() in (t.owner,t.buyer)));
