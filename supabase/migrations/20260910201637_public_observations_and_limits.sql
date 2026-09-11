create table public.public_observations (
 id uuid primary key references public.device_readings(id) on delete cascade,
 area_id uuid not null references public.observation_areas(id),
 measured_at timestamptz not null, averaging_seconds integer not null,
 observation jsonb not null
);
create index public_observations_time_idx on public.public_observations(area_id,measured_at desc);
alter table public.public_observations enable row level security;
revoke all on public.public_observations from anon,authenticated;
grant select on public.public_observations to anon,authenticated;
create policy published_observations on public.public_observations for select to anon,authenticated using(exists(select 1 from public.observation_areas a where a.id=area_id and a.published));
create function rutems_private.project_observation() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.observation_areas;
begin
 select p.* into a from public.observation_areas p join public.devices d on d.area_id=p.id where d.id=new.device_id;
 insert into public.public_observations(id,area_id,measured_at,averaging_seconds,observation) values(new.id,a.id,new.measured_at,new.averaging_seconds,jsonb_build_object(
 'id',new.id,'deviceId','public-area-'||a.id,'locationId',a.id,'measuredAt',new.measured_at,'receivedAt',new.received_at,
 'averagingSeconds',new.averaging_seconds,'raw',new.raw,'corrected',new.corrected,'quality',new.quality,'flags',new.flags,
 'calibrationVersion',new.calibration_version,'demo',false,'lat',a.latitude,'lng',a.longitude,'uncertaintyM',a.uncertainty_m));
 return new;
end; $$;
revoke all on function rutems_private.project_observation() from public;
create trigger project_reading after insert on public.device_readings for each row execute function rutems_private.project_observation();
create or replace function public.public_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('mode','real','clock',now(),'start',now()-interval '7 days','freshMinutes',90,
 'locations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'region',a.region,'context',a.context,'source',a.source,'lat',a.latitude,'lng',a.longitude,'uncertaintyM',a.uncertainty_m,'description',a.description)) from public.observation_areas a where a.published),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(r.observation) from public.observation_areas a cross join lateral (
 select q.observation from public.public_observations q where q.area_id=a.id and q.measured_at<=now() and
 (q.averaging_seconds=3600 and q.measured_at>now()-interval '7 days' or q.id=(select id from public.public_observations x where x.area_id=a.id and x.measured_at<=now() order by measured_at desc limit 1)) order by q.measured_at desc limit 170) r where a.published),'[]'::jsonb));
$$;
create table rutems_private.ingestion_limits(device_id uuid primary key references public.devices(id),minute timestamptz not null,hits integer not null);
alter table rutems_private.ingestion_limits enable row level security;
create or replace function public.authenticate_device(target_device uuid, credential_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.devices; count_hits integer;
begin
 select p.* into d from public.devices p join rutems_private.device_credentials c on c.device_id=p.id where p.id=target_device and c.token_hash=credential_hash and p.state not in ('retired','maintenance');
 if d.id is null then return null; end if;
 insert into rutems_private.ingestion_limits(device_id,minute,hits) values(d.id,date_trunc('minute',now()),1)
 on conflict(device_id) do update set minute=excluded.minute,hits=case when ingestion_limits.minute=excluded.minute then ingestion_limits.hits+1 else 1 end returning hits into count_hits;
 if count_hits>60 then return '{"rateLimited":true}'::jsonb; end if;
 return to_jsonb(d);
end; $$;
