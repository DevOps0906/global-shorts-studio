-- 테스트 6: 승인제(task-019). 미승인은 profiles 본인 행 읽기 외 전부 차단, 승인 후 허용, 승인 취소 시 다시 차단.
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t'),     -- 회원 A(미승인)
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t'),     -- 회원 B(승인)
  ('cccccccc-0000-0000-0000-000000000003', 'op@t'),    -- 운영자(미승인)
  ('dddddddd-0000-0000-0000-000000000004', 'ins@t'),   -- 강사(미승인)
  ('eeeeeeee-0000-0000-0000-000000000005', 'stu@t');   -- 강사 코호트 수강생
update studio.profiles set approved_at = now() where user_id in ('bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000005');
update studio.profiles set role = 'operator' where user_id = 'cccccccc-0000-0000-0000-000000000003';
update studio.profiles set role = 'instructor' where user_id = 'dddddddd-0000-0000-0000-000000000004';
insert into studio.cohort_members (cohort_id, user_id, role) values
  ('99999999-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'student'),
  ('99999999-0000-0000-0000-000000000009', 'dddddddd-0000-0000-0000-000000000004', 'instructor'),
  ('99999999-0000-0000-0000-000000000009', 'eeeeeeee-0000-0000-0000-000000000005', 'student');
insert into studio.projects (id, user_id, type) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'video'),
  ('11111111-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'video'),
  ('11111111-0000-0000-0000-00000000000e', 'eeeeeeee-0000-0000-0000-000000000005', 'video');
insert into studio.drafts (project_id, user_id) values ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into studio.jobs (id, user_id, project_id, kind) values
  ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a', 'analyze'),
  ('22222222-0000-0000-0000-00000000000e', 'eeeeeeee-0000-0000-0000-000000000005', '11111111-0000-0000-0000-00000000000e', 'analyze');
insert into studio.job_steps (job_id, user_id, step_no, label) values ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 's');
insert into studio.credit_ledger (user_id, delta, reason, idempotency_key) values ('aaaaaaaa-0000-0000-0000-000000000001', 5, 'gift', 'ap-a');
insert into studio.linked_accounts (user_id, provider) values ('aaaaaaaa-0000-0000-0000-000000000001', 'threads');
insert into studio.homework_progress (user_id, lesson_no, rule_key) values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'r');
insert into studio.support_tickets (user_id, kind, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bug', 'x');
insert into studio.user_settings (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into radar.channels (user_id, handle, yt_channel_id, uploads_playlist_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '@a', 'UC' || repeat('a', 22), 'UU' || repeat('a', 22));
insert into studio.policy_flags (user_id, type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'low_score');
insert into studio.admin_audit_log (admin_id, action) values ('cccccccc-0000-0000-0000-000000000003', 'x');

-- 카탈로그 검사: RLS 켜진 studio·radar 테이블 중 profiles 외에 approved_only(RESTRICTIVE·ALL·authenticated) 없는 테이블이 있으면 실패
do $$
declare missing text;
begin
  select string_agg(n.nspname || '.' || c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('studio', 'radar') and c.relkind in ('r', 'p') and c.relrowsecurity
    and not (n.nspname = 'studio' and c.relname = 'profiles')
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = n.nspname and p.tablename = c.relname and p.policyname = 'approved_only'
        and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL' and 'authenticated' = any (p.roles)
    );
  if missing is not null then raise exception 'FAIL approved_only missing on %', missing; end if;
end $$;

-- 1) 미승인 A: profiles 본인 행만, 나머지 0건·쓰기 거부
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare t text; n int;
begin
  if studio.is_approved() then raise exception 'FAIL unapproved is_approved'; end if;
  select count(*) into n from studio.profiles;
  if n <> 1 then raise exception 'FAIL unapproved profiles=%', n; end if;
  foreach t in array array['radar.channels','studio.cohort_members','studio.projects','studio.drafts','studio.jobs',
    'studio.job_steps','studio.user_settings','studio.linked_accounts','studio.credit_ledger','studio.homework_progress',
    'studio.support_tickets','studio.policy_flags','studio.admin_audit_log','studio.instructor_job_queue'] loop
    execute format('select count(*) from %s', t) into n;
    if n <> 0 then raise exception 'FAIL unapproved sees % rows=%', t, n; end if;
  end loop;
  begin insert into studio.projects (user_id, type) values (auth.uid(), 'video'); raise exception 'FAIL unapproved project insert';
  exception when insufficient_privilege then null; end;
  begin insert into radar.channels (user_id, handle) values (auth.uid(), '@a2'); raise exception 'FAIL unapproved channel insert';
  exception when insufficient_privilege then null; end;
  begin insert into studio.support_tickets (user_id, kind, body) values (auth.uid(), 'bug', 'y'); raise exception 'FAIL unapproved ticket insert';
  exception when insufficient_privilege then null; end;
  update studio.projects set lang = 'ja' where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL unapproved project update=%', n; end if;
  update studio.user_settings set lang = 'ja' where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL unapproved settings update=%', n; end if;
  delete from radar.channels where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL unapproved channel delete=%', n; end if;
  delete from studio.drafts where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL unapproved draft delete=%', n; end if;
  -- 본인 approved_at 수정 거부
  begin update studio.profiles set approved_at = now() where user_id = auth.uid(); raise exception 'FAIL self approve';
  exception when insufficient_privilege then null; end;
  if studio.is_approved() then raise exception 'FAIL self approve took effect'; end if;
end $$;

-- 2) 승인된 B: 본인 작업 허용, 미승인 A 행에는 영향 없음
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
do $$
declare n int;
begin
  if not studio.is_approved() then raise exception 'FAIL approved is_approved'; end if;
  select count(*) into n from studio.projects;
  if n <> 1 then raise exception 'FAIL approved projects=%', n; end if;
  if radar.add_channel('@b', 'B', 'UC' || repeat('b', 22), 'UU' || repeat('b', 22), 1) <> 'ok' then raise exception 'FAIL approved add_channel'; end if;
  update studio.projects set lang = 'ja' where user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL approved project update=%', n; end if;
  update studio.projects set lang = 'ja' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B updated A project=%', n; end if;
  delete from radar.channels where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B deleted A channel=%', n; end if;
end $$;

-- 3) 미승인 운영자·강사: 판정 거짓, 큐 0건
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
do $$
declare n int;
begin
  if studio.is_operator() then raise exception 'FAIL unapproved operator'; end if;
  select count(*) into n from studio.profiles;
  if n <> 1 then raise exception 'FAIL unapproved operator profiles=%', n; end if;
  select count(*) into n from studio.instructor_job_queue;
  if n <> 0 then raise exception 'FAIL unapproved operator queue=%', n; end if;
end $$;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
do $$
declare n int;
begin
  if studio.is_instructor_of('eeeeeeee-0000-0000-0000-000000000005') then raise exception 'FAIL unapproved instructor'; end if;
  select count(*) into n from studio.instructor_job_queue;
  if n <> 0 then raise exception 'FAIL unapproved instructor queue=%', n; end if;
end $$;

-- 4) 승인 후 운영자·강사 허용(대조군)
reset role;
update studio.profiles set approved_at = now()
  where user_id in ('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
do $$
declare n int;
begin
  if not studio.is_operator() then raise exception 'FAIL approved operator'; end if;
  select count(*) into n from studio.policy_flags;
  if n <> 1 then raise exception 'FAIL approved operator policy_flags=%', n; end if;
  select count(*) into n from studio.instructor_job_queue;
  if n <> 2 then raise exception 'FAIL approved operator queue=%', n; end if;
end $$;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
do $$
declare n int;
begin
  if not studio.is_instructor_of('eeeeeeee-0000-0000-0000-000000000005') then raise exception 'FAIL approved instructor'; end if;
  select count(*) into n from studio.instructor_job_queue;
  if n <> 2 then raise exception 'FAIL approved instructor queue=%', n; end if;
end $$;

-- 5) A 승인 -> 허용, 승인 취소 -> 다시 차단
reset role;
update studio.profiles set approved_at = now() where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare n int;
begin
  select count(*) into n from studio.projects;
  if n <> 1 then raise exception 'FAIL approved A projects=%', n; end if;
  select count(*) into n from studio.credit_ledger;
  if n <> 1 then raise exception 'FAIL approved A ledger=%', n; end if;
  if radar.add_channel('@a2', 'A2', 'UC' || repeat('c', 22), 'UU' || repeat('c', 22), 1) <> 'ok' then raise exception 'FAIL approved A add_channel'; end if;
end $$;
reset role;
update studio.profiles set approved_at = null where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from studio.projects;
  if n <> 0 then raise exception 'FAIL revoked A projects=%', n; end if;
  select count(*) into n from studio.credit_ledger;
  if n <> 0 then raise exception 'FAIL revoked A ledger=%', n; end if;
  select count(*) into n from radar.channels;
  if n <> 0 then raise exception 'FAIL revoked A channels=%', n; end if;
  select count(*) into n from studio.profiles;
  if n <> 1 then raise exception 'FAIL revoked A profiles=%', n; end if;
  begin insert into radar.channels (user_id, handle) values (auth.uid(), '@a3'); raise exception 'FAIL revoked channel insert';
  exception when insufficient_privilege then null; end;
end $$;

-- A의 행은 그대로(서버 권한 확인)
reset role;
do $$ declare n int; begin
  select count(*) into n from radar.channels where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if n <> 2 then raise exception 'FAIL A channels after test=%', n; end if;
  select count(*) into n from studio.projects where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and lang = 'ko';
  if n <> 1 then raise exception 'FAIL A project changed'; end if;
end $$;
rollback;
\echo PASS 06_approval_gate
