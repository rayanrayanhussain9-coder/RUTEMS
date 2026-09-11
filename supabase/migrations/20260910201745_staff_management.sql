create function rutems_private.manage_staff(email_address text,staff_role text,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if auth.uid() is null or rutems_private.staff_role() is distinct from 'admin' then raise exception 'Verified administrator required' using errcode='42501'; end if;
 if staff_role not in ('operator','admin') then raise exception 'Invalid role'; end if;
 select id into target_id from auth.users where lower(email)=lower(trim(email_address)) and email_confirmed_at is not null;
 if target_id is null then raise exception 'The person must create and confirm their account first'; end if;
 if target_id=auth.uid() then raise exception 'You cannot change your own administrator access'; end if;
 insert into public.staff_members(user_id,role,active) values(target_id,staff_role,enabled) on conflict(user_id) do update set role=excluded.role,active=excluded.active;
end; $$;
revoke all on function rutems_private.manage_staff(text,text,boolean) from public;
grant execute on function rutems_private.manage_staff(text,text,boolean) to authenticated;
create function public.manage_staff(email_address text,staff_role text,enabled boolean) returns void language sql security invoker set search_path='' as $$select rutems_private.manage_staff(email_address,staff_role,enabled);$$;
revoke all on function public.manage_staff(text,text,boolean) from public;
grant execute on function public.manage_staff(text,text,boolean) to authenticated;
create function rutems_private.list_staff() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or rutems_private.staff_role() is distinct from 'admin' then raise exception 'Verified administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('email',u.email,'role',s.role,'active',s.active)) from public.staff_members s join auth.users u on u.id=s.user_id),'[]');
end; $$;
revoke all on function rutems_private.list_staff() from public;
grant execute on function rutems_private.list_staff() to authenticated;
create function public.list_staff() returns jsonb language sql security invoker set search_path='' as $$select rutems_private.list_staff();$$;
revoke all on function public.list_staff() from public;
grant execute on function public.list_staff() to authenticated;
