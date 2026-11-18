-- 테스트 5: 리뷰 2차 반영(M1·M2·S1·S4~S8) 확인.
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'stu1@t'),   -- 수강생(코호트 안)
  ('bbbbbbbb-0000-0000-0000-000000000002', 'stu2@t'),   -- 수강생(코호트 밖)
  ('cccccccc-0000-0000-0000-000000000003', 'ins@t');    -- 강사
insert into studio.cohort_members (cohort_id, user_id, role) values
  ('99999999-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'student'),
  ('99999999-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000003', 'instructor');
insert into studio.projects (id, user_id, type) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'video'),
  ('11111111-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'video');
insert into studio.jobs (id, user_id, project_id, kind, status) values
  ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a', 'analyze', 'canceled'),  -- S1
  ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-00000000000b', 'analyze', 'queued');

do $$
declare n int; sid uuid;
begin
  -- S8: 가입 시 profiles 자동 생성(member)
  select count(*) into n from studio.profiles where role = 'member';
  if n <> 3 then raise exception 'FAIL auto profiles=%', n; end if;

  -- S5: source_path는 본인 폴더만
  begin update studio.projects set source_path = 'bbbbbbbb-0000-0000-0000-000000000002/x.mp4' where id = '11111111-0000-0000-0000-00000000000a';
    raise exception 'FAIL source_path foreign folder'; exception when check_violation then null; end;
  update studio.projects set source_path = 'aaaaaaaa-0000-0000-0000-000000000001/x.mp4' where id = '11111111-0000-0000-0000-00000000000a';

  -- S6: 문의 본문 5000자 제한
  begin insert into studio.support_tickets (user_id, kind, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bug', repeat('x', 5001));
    raise exception 'FAIL ticket body length'; exception when check_violation then null; end;
  insert into studio.support_tickets (user_id, kind, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bug', repeat('x', 5000));

  -- S4: token_ref는 같은 사용자·provider의 vault 비밀만
  insert into vault.secrets (name, secret) values ('oauth:aaaaaaaa-0000-0000-0000-000000000001:threads', 's') returning id into sid;
  insert into vault.secrets (name, secret) values ('oauth:bbbbbbbb-0000-0000-0000-000000000002:threads', 's2');
  begin insert into studio.linked_accounts (user_id, provider, token_ref) values ('aaaaaaaa-0000-0000-0000-000000000001', 'youtube_kr', sid::text);
    raise exception 'FAIL token_ref provider mismatch'; exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if; end;
  begin insert into studio.linked_accounts (user_id, provider, token_ref) values ('bbbbbbbb-0000-0000-0000-000000000002', 'threads', sid::text);
    raise exception 'FAIL token_ref other user secret'; exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if; end;
  insert into studio.linked_accounts (user_id, provider, token_ref) values ('aaaaaaaa-0000-0000-0000-000000000001', 'threads', sid::text);
  -- C1: 삭제하면 vault 비밀도 삭제(다른 사용자 비밀은 유지)
  delete from studio.linked_accounts where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n from vault.secrets;
  if n <> 1 then raise exception 'FAIL vault secrets after delete=%', n; end if;

  -- M2: 작업·계정이 지워져도 policy_flags 보존
  insert into studio.policy_flags (job_id, user_id, project_id, type)
    values ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-00000000000b', 'no_rights');
  delete from studio.jobs where id = '22222222-0000-0000-0000-00000000000b';
  select count(*) into n from studio.policy_flags where job_id is null and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if n <> 1 then raise exception 'FAIL policy_flags not retained'; end if;
  delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  select count(*) into n from studio.policy_flags;
  if n <> 1 then raise exception 'FAIL policy_flags after user delete'; end if;

  -- S7: 운영자 계정이 지워져도 감사 로그 보존(admin_id null)
  insert into studio.admin_audit_log (admin_id, action) values ('cccccccc-0000-0000-0000-000000000003', 'x');
end $$;

-- 새 작업 하나 더(코호트 밖 수강생은 삭제됐으므로 새 사용자)
insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000004', 'stu3@t');
insert into studio.projects (id, user_id, type) values ('11111111-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-000000000004', 'video');
insert into studio.jobs (id, user_id, project_id, kind) values
  ('22222222-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-000000000004', '11111111-0000-0000-0000-00000000000d', 'tts');

-- 승인된 사용자 기준(task-019 승인제)
update studio.profiles set approved_at = now();

-- M1: 강사는 뷰로 코호트 수강생 작업만(최소 컬럼), jobs 직접 열람 불가
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
do $$
declare n int; cols text[];
begin
  select count(*), min(user_id::text) into n from studio.instructor_job_queue;
  if n <> 1 then raise exception 'FAIL instructor view rows=%', n; end if;
  if (select user_id from studio.instructor_job_queue) <> 'aaaaaaaa-0000-0000-0000-000000000001' then raise exception 'FAIL instructor view wrong user'; end if;
  select count(*) into n from studio.jobs;
  if n <> 0 then raise exception 'FAIL instructor reads jobs directly=%', n; end if;
  begin perform edit_state from studio.drafts; exception when others then null; end;
  begin perform source_url from studio.instructor_job_queue; raise exception 'FAIL view exposes extra column';
  exception when undefined_column then null; end;
end $$;

-- 일반 회원은 뷰가 비어 있다
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
do $$ declare n int; begin
  select count(*) into n from studio.instructor_job_queue;
  if n <> 0 then raise exception 'FAIL member sees queue=%', n; end if;
end $$;

-- 감사 로그 보존 확인(서버 권한)
reset role;
delete from auth.users where id = 'cccccccc-0000-0000-0000-000000000003';
do $$ declare n int; begin
  select count(*) into n from studio.admin_audit_log where admin_id is null;
  if n <> 1 then raise exception 'FAIL audit not retained'; end if;
end $$;
rollback;
\echo PASS 05_review_fixes
