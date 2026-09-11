-- Real records only. No demo seed or automatic administrator assignment.
create schema if not exists rutems_private;
revoke all on schema rutems_private from public, anon, authenticated;
create table public.staff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','operator')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;
create policy own_membership on public.staff_members for select to authenticated using (user_id = (select auth.uid()));

-- Narrow helper reads only the caller's administrator-maintained membership.
create function rutems_private.staff_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.staff_members where user_id=auth.uid() and active;
$$;
revoke all on function rutems_private.staff_role() from public;
grant usage on schema rutems_private to authenticated;
grant execute on function rutems_private.staff_role() to authenticated;

create table public.observation_areas (
 id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 2 and 120),
 region text not null check (length(region) between 2 and 120),
 context text not null check(context in ('urban','trail')),
 source text not null check(source in ('fixed','mobile')),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 uncertainty_m integer not null default 100 check(uncertainty_m between 1 and 100000),
 description text not null default '', published boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.observation_areas enable row level security;
revoke all on public.observation_areas from anon, authenticated;
grant select on public.observation_areas to anon, authenticated;
grant insert, update on public.observation_areas to authenticated;
create policy public_area on public.observation_areas for select to anon using (published);
create policy staff_area_read on public.observation_areas for select to authenticated using (published or rutems_private.staff_role()='admin' or (rutems_private.staff_role()='operator' and created_by=auth.uid()));
create policy staff_area_create on public.observation_areas for insert to authenticated with check (rutems_private.staff_role() in ('admin','operator') and created_by=auth.uid() and (not published or rutems_private.staff_role()='admin'));
create policy admin_area_update on public.observation_areas for update to authenticated using (rutems_private.staff_role()='admin') with check (rutems_private.staff_role()='admin');

create table public.devices (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 area_id uuid not null references public.observation_areas(id),
 deployment text not null check(deployment in ('fixed','wearable','vehicle')),
 state text not null default 'awaiting' check(state in ('awaiting','active','maintenance','retired')),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 sensor_model text not null check(length(sensor_model) between 1 and 200),
 firmware_version text not null default '', calibration_version text not null default 'unverified',
 upload_interval_seconds integer not null default 60 check(upload_interval_seconds between 10 and 86400),
 last_contact timestamptz, battery numeric check(battery between 0 and 100),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index devices_area_idx on public.devices(area_id);
create index devices_owner_idx on public.devices(created_by);
alter table public.devices enable row level security;
revoke all on public.devices from anon, authenticated;
grant select, insert on public.devices to authenticated;
grant update(name,state,firmware_version,calibration_version,upload_interval_seconds) on public.devices to authenticated;
create policy device_read on public.devices for select to authenticated using (rutems_private.staff_role()='admin' or (rutems_private.staff_role()='operator' and created_by=auth.uid()));
create policy device_create on public.devices for insert to authenticated with check (rutems_private.staff_role() in ('admin','operator') and created_by=auth.uid() and state='awaiting' and last_contact is null and battery is null and exists(select 1 from public.observation_areas a where a.id=area_id and (a.created_by=auth.uid() or rutems_private.staff_role()='admin')));
create policy device_update on public.devices for update to authenticated using (rutems_private.staff_role()='admin' or (rutems_private.staff_role()='operator' and created_by=auth.uid())) with check (rutems_private.staff_role()='admin' or (rutems_private.staff_role()='operator' and created_by=auth.uid()));

create table public.maintenance_events (
 id uuid primary key default gen_random_uuid(), device_id uuid not null references public.devices(id),
 note text not null check(length(note) between 1 and 4000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create index maintenance_device_idx on public.maintenance_events(device_id,created_at desc);
alter table public.maintenance_events enable row level security;
revoke all on public.maintenance_events from anon,authenticated;
grant select,insert on public.maintenance_events to authenticated;
create policy maintenance_read on public.maintenance_events for select to authenticated using (exists(select 1 from public.devices d where d.id=device_id));
create policy maintenance_create on public.maintenance_events for insert to authenticated with check (created_by=auth.uid() and rutems_private.staff_role() in ('operator','admin') and exists(select 1 from public.devices d where d.id=device_id));

create table rutems_private.device_credentials (
 device_id uuid primary key references public.devices(id), token_hash text not null,
 created_at timestamptz not null default now()
);
alter table rutems_private.device_credentials enable row level security;
create table public.device_readings (
 id uuid primary key default gen_random_uuid(), device_id uuid not null references public.devices(id),
 message_id text not null check(length(message_id) between 1 and 120),
 measured_at timestamptz not null, received_at timestamptz not null default now(),
 averaging_seconds integer not null check(averaging_seconds between 1 and 86400),
 raw jsonb not null, corrected jsonb,
 quality text not null check(quality in ('valid','suspect','invalid')), flags text[] not null default '{}',
 calibration_version text not null,
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 unique(device_id,message_id), unique(device_id,measured_at,averaging_seconds)
);
create index readings_device_time_idx on public.device_readings(device_id,measured_at desc);
alter table public.device_readings enable row level security;
revoke all on public.device_readings from anon,authenticated;
grant select on public.device_readings to authenticated;
create policy reading_staff on public.device_readings for select to authenticated using (exists(select 1 from public.devices d where d.id=device_id));

create table public.audit_events (
 id bigint generated always as identity primary key, actor_id uuid, entity text not null,
 entity_id uuid, action text not null, recorded_at timestamptz not null default now(), changes jsonb not null
);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon,authenticated;
grant select on public.audit_events to authenticated;
create policy audit_admin on public.audit_events for select to authenticated using(rutems_private.staff_role()='admin');
create function rutems_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,entity,entity_id,action,changes) values(auth.uid(),tg_table_name,coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(new)->>'user_id')::uuid),tg_op,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end; $$;
revoke all on function rutems_private.audit_change() from public;
create trigger audit_devices after insert or update on public.devices for each row execute function rutems_private.audit_change();
create trigger audit_areas after insert or update on public.observation_areas for each row execute function rutems_private.audit_change();
create trigger audit_staff after insert or update on public.staff_members for each row execute function rutems_private.audit_change();

-- Expose only generalized public areas; no device identities or exact tracks.
create function public.public_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('mode','real','clock',now(),'start',now()-interval '7 days','freshMinutes',90,
 'locations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'region',a.region,'context',a.context,'source',a.source,'lat',a.latitude,'lng',a.longitude,'uncertaintyM',a.uncertainty_m,'description',a.description)) from public.observation_areas a where a.published),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(jsonb_build_object(
 'id',r.id,'deviceId','public-area-'||a.id,'locationId',a.id,'measuredAt',r.measured_at,'receivedAt',r.received_at,
 'averagingSeconds',r.averaging_seconds,'raw',r.raw,'corrected',r.corrected,'quality',r.quality,'flags',r.flags,
 'calibrationVersion',r.calibration_version,'demo',false,'lat',a.latitude,'lng',a.longitude,'uncertaintyM',a.uncertainty_m))
 from public.observation_areas a join public.devices d on d.area_id=a.id
 cross join lateral (select * from public.device_readings q where q.device_id=d.id and q.measured_at<=now()
 and (q.averaging_seconds=3600 and q.measured_at>now()-interval '7 days' or q.id=(select id from public.device_readings x where x.device_id=d.id and x.measured_at<=now() order by measured_at desc limit 1))
 order by q.measured_at desc limit 170) r where a.published),'[]'::jsonb));
$$;
revoke all on function public.public_snapshot() from public;
grant execute on function public.public_snapshot() to anon,authenticated;
