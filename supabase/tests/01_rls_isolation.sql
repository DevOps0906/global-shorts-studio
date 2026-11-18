-- 테스트 1: 타인 행 읽기 0건. 실패하면 예외로 중단(psql -v ON_ERROR_STOP=1).
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t');
-- profiles는 auth.users 트리거가 자동 생성(S8)
insert into studio.projects (id, user_id, type) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'video'),
  ('11111111-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'video');
insert into studio.drafts (project_id, user_id) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002');
insert into studio.jobs (id, user_id, project_id, kind) values
  ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a', 'analyze'),
  ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-00000000000b', 'analyze');
insert into studio.job_steps (job_id, user_id, step_no, label) values
  ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 's'),
  ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 's');
insert into studio.credit_ledger (user_id, delta, reason, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 5, 'gift', 'rls-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 5, 'gift', 'rls-b');
insert into studio.linked_accounts (user_id, provider) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'threads'), ('bbbbbbbb-0000-0000-0000-000000000002', 'threads');
insert into studio.homework_progress (user_id, lesson_no, rule_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'r'), ('bbbbbbbb-0000-0000-0000-000000000002', 1, 'r');
insert into studio.support_tickets (user_id, kind, body) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bug', 'x'), ('bbbbbbbb-0000-0000-0000-000000000002', 'bug', 'x');
insert into radar.channels (user_id, handle) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '@a'), ('bbbbbbbb-0000-0000-0000-000000000002', '@b');
insert into studio.policy_flags (job_id, user_id, project_id, type) values ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-00000000000b', 'low_score');

-- 승인된 사용자 기준(task-019 승인제)
update studio.profiles set approved_at = now();

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

do $$
declare t text; n int; own int;
begin
  foreach t in array array['studio.profiles','studio.projects','studio.drafts','studio.jobs','studio.job_steps',
    'studio.credit_ledger','studio.homework_progress','studio.support_tickets','radar.channels'] loop
    execute format('select count(*) from %s where user_id <> auth.uid()', t) into n;
    execute format('select count(*) from %s where user_id = auth.uid()', t) into own;
    if n <> 0 or own <> 1 then raise exception 'FAIL % other=% own=%', t, n, own; end if;
  end loop;
  -- 본인 linked_accounts(token_ref 제외)
  select count(*) into n from studio.linked_accounts;
  if n <> 1 then raise exception 'FAIL linked_accounts visible=%', n; end if;
  begin
    perform token_ref from studio.linked_accounts;
    raise exception 'FAIL token_ref readable';
  exception when insufficient_privilege then null; end;
  -- 운영자 전용 테이블은 일반 회원에게 0건
  select count(*) into n from studio.policy_flags;
  if n <> 0 then raise exception 'FAIL policy_flags visible=%', n; end if;
  select count(*) into n from studio.admin_audit_log;
  if n <> 0 then raise exception 'FAIL audit visible=%', n; end if;
  -- 쓰기 차단: jobs·homework_progress·credit_ledger 직접 쓰기 거부
  begin insert into studio.jobs (user_id, kind) values (auth.uid(), 'tts'); raise exception 'FAIL jobs insert';
  exception when insufficient_privilege then null; end;
  begin update studio.jobs set status = 'done'; raise exception 'FAIL jobs update';
  exception when insufficient_privilege then null; end;
  begin delete from studio.homework_progress; raise exception 'FAIL homework delete';
  exception when insufficient_privilege then null; end;
  begin insert into studio.credit_ledger (user_id, delta, reason, idempotency_key) values (auth.uid(), 99, 'gift', 'hack'); raise exception 'FAIL ledger insert';
  exception when insufficient_privilege then null; end;
  -- 본인 projects 삭제 불가(소프트 삭제는 서버만)
  begin delete from studio.projects where user_id = auth.uid(); raise exception 'FAIL project delete';
  exception when insufficient_privilege then null; end;
  -- 타인 명의 projects 삽입은 RLS가 거부
  begin insert into studio.projects (user_id, type) values ('bbbbbbbb-0000-0000-0000-000000000002', 'video'); raise exception 'FAIL project spoof';
  exception when insufficient_privilege then null; when others then
    if sqlstate <> '42501' then raise; end if; end;
  -- 크레딧 함수는 authenticated에서 실행 불가
  begin perform studio.grant_credits(auth.uid(), 100, 'gift', 'self'); raise exception 'FAIL grant_credits callable';
  exception when insufficient_privilege then null; end;
end $$;

-- 타인의 projects를 고치려 해도 0행
do $$
declare n int;
begin
  update studio.projects set lang = 'ja' where user_id <> auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL updated others projects %', n; end if;
end $$;
rollback;
\echo PASS 01_rls_isolation
