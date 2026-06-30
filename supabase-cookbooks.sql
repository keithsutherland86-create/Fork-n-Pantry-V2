-- Shared cookbooks
create table if not exists shared_cookbooks (
  id text primary key,
  name text not null,
  emoji text default '📗',
  owner_id uuid references auth.users not null,
  owner_name text,
  member_ids uuid[] default '{}',
  invite_code text unique not null default substr(md5(random()::text||extract(epoch from now())::text), 1, 10),
  created_at timestamptz default now()
);

create table if not exists shared_cookbook_recipes (
  id text primary key default gen_random_uuid()::text,
  cookbook_id text references shared_cookbooks(id) on delete cascade,
  recipe jsonb not null,
  added_by uuid references auth.users,
  added_by_name text,
  created_at timestamptz default now()
);

alter table shared_cookbooks enable row level security;
alter table shared_cookbook_recipes enable row level security;

create policy "sc_read" on shared_cookbooks for select
  using (owner_id = auth.uid() or auth.uid() = any(member_ids));
create policy "sc_insert" on shared_cookbooks for insert
  with check (owner_id = auth.uid());
create policy "sc_update" on shared_cookbooks for update
  using (owner_id = auth.uid());
create policy "sc_delete" on shared_cookbooks for delete
  using (owner_id = auth.uid());

create policy "scr_read" on shared_cookbook_recipes for select
  using (exists(select 1 from shared_cookbooks sc where sc.id = cookbook_id and (sc.owner_id = auth.uid() or auth.uid() = any(sc.member_ids))));
create policy "scr_insert" on shared_cookbook_recipes for insert
  with check (exists(select 1 from shared_cookbooks sc where sc.id = cookbook_id and (sc.owner_id = auth.uid() or auth.uid() = any(sc.member_ids))));
create policy "scr_delete" on shared_cookbook_recipes for delete
  using (added_by = auth.uid());

-- Get cookbook info by invite code (callable before joining)
create or replace function cookbook_by_invite(code text)
returns table(id text, name text, emoji text, owner_name text)
language sql security definer
as $$
  select id, name, emoji, owner_name from shared_cookbooks where invite_code = code limit 1;
$$;

-- Join a cookbook by invite code
create or replace function join_cookbook(code text)
returns text
language plpgsql security definer
as $$
declare cb_id text;
begin
  update shared_cookbooks
  set member_ids = array_append(member_ids, auth.uid())
  where invite_code = code and auth.uid() != owner_id and not (auth.uid() = any(member_ids))
  returning id into cb_id;
  return cb_id;
end;
$$;
