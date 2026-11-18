-- 로컬 postgres:17 전용 Supabase 스텁(테스트 전용, 마이그레이션 아님).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create publication supabase_realtime;
-- Storage 스텁(task-006a): 버킷·객체 최소 컬럼, 정책은 마이그레이션이 붙인다.
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner_id text, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
-- pgmq 스텁(task-006a): send만. 실제 확장은 원격 Supabase Queues(마이그레이션 queues.sql).
create schema pgmq;
create table pgmq.q_analyze (msg_id bigint generated always as identity primary key, message jsonb not null);
create function pgmq.send(queue_name text, msg jsonb, delay integer default 0) returns setof bigint language plpgsql as $$
begin
  if queue_name <> 'analyze' then raise exception 'stub: unknown queue %', queue_name; end if;
  if current_setting('test.pgmq_fail', true) = 'on' then raise exception 'stub: pgmq send failed'; end if;   -- 실패 주입 스위치
  return query insert into pgmq.q_analyze (message) values (msg) returning msg_id;
end $$;
revoke all on schema pgmq from public;
