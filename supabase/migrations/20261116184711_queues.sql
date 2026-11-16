-- 작업 큐(PLAN 13-4·13-10: pgmq = Supabase Queues). 워커(service_role)만 보내고 읽는다.
-- 메시지: { job_id, project_id, kind, idempotency_key }. 웹은 큐를 직접 만지지 않고 서버 DB 함수로만 넣는다.
create extension if not exists pgmq;

select pgmq.create(q) from unnest(array['analyze','tts','render','translate','scan']) as q;

-- 큐·아카이브 테이블도 RLS 활성(AGENTS.md 모든 테이블 RLS). 정책 없음 = service_role(우회)만 접근.
do $$
declare q text;
begin
  foreach q in array array['analyze','tts','render','translate','scan'] loop
    execute format('alter table pgmq.%I enable row level security', 'q_' || q);
    execute format('alter table pgmq.%I enable row level security', 'a_' || q);
  end loop;
end $$;

-- anon·authenticated 접근 0. pgmq_public(Data API 노출용) 스키마는 만들지 않는다.
revoke all on schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
revoke all on all sequences in schema pgmq from public, anon, authenticated;
revoke execute on all functions in schema pgmq from public, anon, authenticated;
alter default privileges in schema pgmq revoke all on tables from public, anon, authenticated;
alter default privileges in schema pgmq revoke all on sequences from public, anon, authenticated;
alter default privileges in schema pgmq revoke execute on functions from public, anon, authenticated;

grant usage on schema pgmq to service_role;
grant all on all tables in schema pgmq to service_role;
grant all on all sequences in schema pgmq to service_role;
grant execute on all functions in schema pgmq to service_role;
