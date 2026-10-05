-- Swap database. Paste into Supabase → SQL Editor → Run.
create extension if not exists pgcrypto;

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  name text, verified boolean not null default false, is_admin boolean not null default false);
create table items(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references profiles(id) default auth.uid(),
  title text not null, category text not null, condition text, description text, want text,
  photo_path text, created_at timestamptz default now());
create table verifications(
  user_id uuid primary key references profiles(id) default auth.uid(),
  id_type text not null, last4 text not null, file_path text not null,
  status text not null default 'pending', submitted_at timestamptz default now());
create table threads(
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  owner uuid not null references profiles(id),
  buyer uuid not null references profiles(id) default auth.uid(),
  last_at timestamptz default now(), unique(item_id,buyer));
create table messages(
  id bigint generated always as identity primary key,
  thread_id uuid not null references threads on delete cascade,
  sender uuid not null references profiles(id) default auth.uid(),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz default now());

-- helpers
create function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select coalesce((select is_admin from profiles where id=auth.uid()),false) $$;
create function is_verified() returns boolean language sql security definer stable set search_path=public as
$$ select coalesce((select verified from profiles where id=auth.uid()),false) $$;
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into profiles(id,name) values(new.id,
  coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(new.email,'@',1)));
  return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
-- only admins can approve/reject (also flips profiles.verified)
create function review_verification(target uuid, approve boolean) returns void language plpgsql security definer set search_path=public as
$$ begin
  if not is_admin() then raise exception 'admin only'; end if;
  update verifications set status=case when approve then 'approved' else 'rejected' end where user_id=target;
  update profiles set verified=approve where id=target;
end $$;

-- row level security
alter table profiles enable row level security;
alter table items enable row level security;
alter table verifications enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;

revoke update on profiles from authenticated, anon;
grant update(name) on profiles to authenticated;
create policy "read profiles" on profiles for select to authenticated using(true);
create policy "edit own name" on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy "read items" on items for select to authenticated using(true);
create policy "verified users post" on items for insert to authenticated with check(owner=auth.uid() and is_verified());
create policy "owner edits" on items for update to authenticated using(owner=auth.uid());
create policy "owner deletes" on items for delete to authenticated using(owner=auth.uid());

create policy "own or admin reads id record" on verifications for select to authenticated using(user_id=auth.uid() or is_admin());
create policy "submit own id" on verifications for insert to authenticated with check(user_id=auth.uid() and status='pending');
create policy "resubmit own id" on verifications for update to authenticated using(user_id=auth.uid() and status<>'approved') with check(user_id=auth.uid() and status='pending');

-- chats: only the two people in a thread can see or write to it
create policy "see own threads" on threads for select to authenticated using(auth.uid() in (owner,buyer));
create policy "start thread" on threads for insert to authenticated
  with check(buyer=auth.uid() and is_verified() and owner=(select i.owner from items i where i.id=item_id) and owner<>auth.uid());
create policy "touch own thread" on threads for update to authenticated using(auth.uid() in (owner,buyer));
create policy "read own messages" on messages for select to authenticated
  using(exists(select 1 from threads t where t.id=thread_id and auth.uid() in (t.owner,t.buyer)));
create policy "send own messages" on messages for insert to authenticated
  with check(sender=auth.uid() and is_verified() and exists(select 1 from threads t where t.id=thread_id and auth.uid() in (t.owner,t.buyer)));
alter publication supabase_realtime add table messages;

-- storage: item photos are public, ID photos are private (owner + admin only)
insert into storage.buckets(id,name,public) values('item-photos','item-photos',true),('ids','ids',false) on conflict do nothing;
create policy "upload own photos" on storage.objects for insert to authenticated
  with check(bucket_id='item-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "upload own id" on storage.objects for insert to authenticated
  with check(bucket_id='ids' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "read own id or admin" on storage.objects for select to authenticated
  using(bucket_id='ids' and ((storage.foldername(name))[1]=auth.uid()::text or is_admin()));
