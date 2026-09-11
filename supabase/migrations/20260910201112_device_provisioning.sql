create extension if not exists pgcrypto with schema extensions;
create or replace function rutems_private.staff_role() returns text language sql stable security definer set search_path='' as $$
 select case when role='admin' and coalesce(auth.jwt()->>'aal','')<>'aal2' then null else role end
 from public.staff_members where user_id=auth.uid() and active;
$$;
create function rutems_private.provision_device(target_device uuid) returns text language plpgsql security definer set search_path='' as $$
declare credential text;
begin
 if auth.uid() is null or not exists(select 1 from public.devices d where d.id=target_device and (rutems_private.staff_role()='admin' or (rutems_private.staff_role()='operator' and d.created_by=auth.uid()))) then raise exception 'Device permission or administrator verification required' using errcode='42501'; end if;
 credential=encode(extensions.gen_random_bytes(32),'hex');
 insert into rutems_private.device_credentials(device_id,token_hash) values(target_device,encode(extensions.digest(credential,'sha256'),'hex')) on conflict(device_id) do update set token_hash=excluded.token_hash,created_at=now();
 insert into public.audit_events(actor_id,entity,entity_id,action,changes) values(auth.uid(),'devices',target_device,'credential_rotated','{}');
 return credential;
end; $$;
revoke all on function rutems_private.provision_device(uuid) from public;
grant execute on function rutems_private.provision_device(uuid) to authenticated;
create function public.provision_device(target_device uuid) returns text language sql security invoker set search_path='' as $$ select rutems_private.provision_device(target_device); $$;
revoke all on function public.provision_device(uuid) from public;
grant execute on function public.provision_device(uuid) to authenticated;
-- Called only by the authenticated device gateway using its server-side key.
create function public.authenticate_device(target_device uuid, credential_hash text) returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(d) from public.devices d join rutems_private.device_credentials c on c.device_id=d.id where d.id=target_device and c.token_hash=credential_hash and d.state not in ('retired','maintenance');
$$;
revoke all on function public.authenticate_device(uuid,text) from public,anon,authenticated;
grant execute on function public.authenticate_device(uuid,text) to service_role;
