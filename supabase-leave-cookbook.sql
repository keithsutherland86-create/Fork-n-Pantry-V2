-- Remove a member from a shared cookbook, keeping parallel arrays in sync
create or replace function leave_cookbook(p_cookbook_id text)
returns void
language plpgsql security definer
as $$
declare
  idx int;
begin
  select array_position(member_ids, auth.uid())
  into idx
  from shared_cookbooks
  where id = p_cookbook_id;

  if idx is not null then
    update shared_cookbooks
    set
      member_ids   = member_ids[1:idx-1]   || member_ids[idx+1:],
      member_names = member_names[1:idx-1] || member_names[idx+1:]
    where id = p_cookbook_id;
  end if;
end;
$$;
