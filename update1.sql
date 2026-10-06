-- Run once in Supabase → SQL Editor (for the project you already set up)
alter table profiles add column if not exists city text;
grant update(name,city) on profiles to authenticated;
alter table items add column if not exists city text;
alter table items add column if not exists status text not null default 'available';
alter table threads add column if not exists last_sender uuid;
alter table threads add column if not exists owner_seen timestamptz default now();
alter table threads add column if not exists buyer_seen timestamptz default now();

-- when a message is sent, record time + sender on the thread (server clock)
create function touch_thread() returns trigger language plpgsql security definer set search_path=public as
$$ begin update threads set last_at=now(), last_sender=new.sender where id=new.thread_id; return new; end $$;
create trigger on_message_insert after insert on messages for each row execute function touch_thread();

-- mark a thread as read for the calling user
create function mark_seen(tid uuid) returns void language plpgsql security definer set search_path=public as
$$ begin update threads set
  owner_seen=case when owner=auth.uid() then now() else owner_seen end,
  buyer_seen=case when buyer=auth.uid() then now() else buyer_seen end
  where id=tid and auth.uid() in (owner,buyer); end $$;

alter publication supabase_realtime add table threads;
