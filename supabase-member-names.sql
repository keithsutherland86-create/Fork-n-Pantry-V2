-- Store member display names alongside their IDs
alter table shared_cookbooks add column if not exists member_names text[] default '{}';

-- Update join function to also record the member's display name
create or replace function join_cookbook(code text, display_name text default '')
returns text
language plpgsql security definer
as $$
declare cb_id text;
begin
  update shared_cookbooks
  set
    member_ids   = array_append(member_ids,   auth.uid()),
    member_names = array_append(member_names, display_name)
  where invite_code = code
    and auth.uid() != owner_id
    and not (auth.uid() = any(member_ids))
  returning id into cb_id;
  return cb_id;
end;
$$;
