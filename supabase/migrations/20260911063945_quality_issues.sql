create table public.quality_issues (
 id uuid primary key default gen_random_uuid(), device_id uuid not null references public.devices(id),
 message_id text not null, reason text not null,
 status text not null default 'open' check(status in ('open','acknowledged','resolved')),
 note text not null default '' check(length(note)<=4000),
 created_at timestamptz not null default now(),
 unique(device_id,message_id,reason)
);
create index quality_device_idx on public.quality_issues(device_id,created_at desc);
alter table public.quality_issues enable row level security;
revoke all on public.quality_issues from anon,authenticated;
grant select on public.quality_issues to authenticated;
grant update(status,note) on public.quality_issues to authenticated;
create policy quality_read on public.quality_issues for select to authenticated using(exists(select 1 from public.devices d where d.id=device_id));
create policy quality_update on public.quality_issues for update to authenticated using(exists(select 1 from public.devices d where d.id=device_id)) with check(exists(select 1 from public.devices d where d.id=device_id));
create function rutems_private.quality_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Staff identity required'; end if;
 insert into public.maintenance_events(device_id,note,created_by) values(new.device_id,'Issue '||new.id||': '||old.status||' → '||new.status||case when new.note<>'' then '. '||new.note else '' end,auth.uid());
 return new;
end; $$;
revoke all on function rutems_private.quality_history() from public;
create trigger quality_history after update on public.quality_issues for each row execute function rutems_private.quality_history();
