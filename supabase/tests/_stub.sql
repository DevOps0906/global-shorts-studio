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
