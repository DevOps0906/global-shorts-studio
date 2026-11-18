-- 테스트 9: 분석 시작(task-006a). 직접 쓰기 회수·업로드 정책·경로 위조·권리 누락·중복 job·동시 한도·하루 상한·잔액 부족·취소 환불.
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t'),     -- 승인 A(크레딧 3)
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t'),     -- 승인 B(크레딧 0)
  ('dddddddd-0000-0000-0000-000000000004', 'u@t');     -- 미승인
update studio.profiles set approved_at = now() where user_id <> 'dddddddd-0000-0000-0000-000000000004';
select studio.grant_credits('aaaaaaaa-0000-0000-0000-000000000001', 3, 'gift', 't9-a');
create temp table t9 (k text primary key, v text);
grant all on t9 to authenticated;

-- 0) 카탈로그: 버킷·인덱스·컬럼·Realtime
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'sources' and not public and file_size_limit = 524288000
                 and allowed_mime_types = array['video/mp4','video/quicktime','video/webm']) then
    raise exception 'FAIL bucket sources'; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'studio' and tablename = 'jobs') then
    raise exception 'FAIL realtime jobs'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'studio' and table_name = 'job_steps'
      and column_name in ('started_at','error_code')) <> 2 then raise exception 'FAIL job_steps columns'; end if;
end $$;

-- 1) 미승인: create_project 거부, 업로드 거부
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
do $$
begin
  if studio.create_project('video','ko','keep','mp4')->>'result' <> 'not_approved' then raise exception 'FAIL unapproved create'; end if;
  if studio.start_analyze(gen_random_uuid(), 'own')->>'result' <> 'not_approved' then raise exception 'FAIL unapproved start'; end if;
  begin insert into storage.objects (bucket_id, name) values ('sources', auth.uid() || '/x/source.mp4'); raise exception 'FAIL unapproved upload';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) A: 직접 쓰기 거부, create_project, 업로드 정책
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare r jsonb; p uuid; path text;
begin
  begin insert into studio.projects (user_id, type) values (auth.uid(), 'video'); raise exception 'FAIL direct project insert';
  exception when insufficient_privilege then null; end;
  if studio.create_project('video','ko','keep','avi')->>'result' <> 'invalid_request' then raise exception 'FAIL bad ext'; end if;
  if studio.create_project('video','en','keep','mp4')->>'result' <> 'invalid_request' then raise exception 'FAIL bad lang'; end if;
  r := studio.create_project('script','ja','short','mov');
  if r->>'result' <> 'ok' then raise exception 'FAIL create %', r; end if;
  p := (r->>'project_id')::uuid; path := r->>'source_path';
  if path <> auth.uid() || '/' || p || '/source.mov' then raise exception 'FAIL path %', path; end if;
  insert into t9 values ('p1', p::text), ('path1', path);
  begin update studio.projects set source_path = auth.uid() || '/x.mp4' where id = p; raise exception 'FAIL source_path update';
  exception when insufficient_privilege then null; end;
  begin update studio.projects set license_type = 'own' where id = p; raise exception 'FAIL license update';
  exception when insufficient_privilege then null; end;
  begin insert into studio.drafts (project_id, user_id) values (p, auth.uid()); raise exception 'FAIL direct draft insert';
  exception when insufficient_privilege then null; end;
  -- 업로드 전 시작 -> source_missing
  if studio.start_analyze(p, 'own')->>'result' <> 'source_missing' then raise exception 'FAIL start before upload'; end if;
  -- 업로드: 남의 폴더·내 폴더 임의 경로 거부, 정해진 경로만 허용
  begin insert into storage.objects (bucket_id, name) values ('sources', 'bbbbbbbb-0000-0000-0000-000000000002/' || p || '/source.mov');
    raise exception 'FAIL foreign folder upload'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('sources', auth.uid() || '/free/source.mp4');
    raise exception 'FAIL arbitrary path upload'; exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('sources', path);
end $$;

-- 3) 권리 누락 -> 거부 + no_rights 기록, 잡·원장 변화 없음 / 정상 시작
do $$
declare r jsonb; p uuid := (select v from t9 where k = 'p1'); j uuid; n int; bal int;
begin
  if studio.start_analyze(p, null)->>'result' <> 'rights_not_confirmed' then raise exception 'FAIL rights null'; end if;
  if studio.start_analyze(p, 'stolen')->>'result' <> 'rights_not_confirmed' then raise exception 'FAIL rights bad'; end if;
  select count(*) into n from studio.jobs where project_id = p;
  if n <> 0 then raise exception 'FAIL job after rights fail'; end if;
  r := studio.start_analyze(p, 'permission');
  if r->>'result' <> 'ok' then raise exception 'FAIL start %', r; end if;
  j := (r->>'job_id')::uuid;
  insert into t9 values ('j1', j::text);
  select count(*) into n from studio.jobs where id = j and status = 'queued' and cost_credits = 1;
  if n <> 1 then raise exception 'FAIL job row'; end if;
  select count(*) into n from studio.job_steps where job_id = j;
  if n <> 4 then raise exception 'FAIL job_steps=%', n; end if;
  select count(*) into n from studio.projects where id = p and status = 'analyzing' and license_type = 'permission' and rights_confirmed_at is not null;
  if n <> 1 then raise exception 'FAIL project after start'; end if;
  select sum(delta) into bal from studio.credit_ledger;
  if bal <> 2 then raise exception 'FAIL balance=%', bal; end if;
  -- 같은 작업물 다시 -> already_running(같은 job_id), 차감 없음
  r := studio.start_analyze(p, 'own');
  if r->>'result' <> 'already_running' or (r->>'job_id')::uuid <> j then raise exception 'FAIL dup %', r; end if;
  select sum(delta) into bal from studio.credit_ledger;
  if bal <> 2 then raise exception 'FAIL balance after dup=%', bal; end if;
end $$;

-- 4) 확인(관리자): 정책 기록·큐 메시지·부분 unique index
reset role;
do $$
declare p uuid := (select v from t9 where k = 'p1'); j uuid := (select v from t9 where k = 'j1'); n int;
begin
  select count(*) into n from studio.policy_flags where project_id = p and type = 'no_rights';
  if n <> 1 then raise exception 'FAIL no_rights flags=% (작업물당 1건)', n; end if;
  select count(*) into n from pgmq.q_analyze where message->>'job_id' = j::text and message->>'idempotency_key' = j || ':spend:1'
    and message->>'kind' = 'analyze' and message->>'project_id' = p::text;
  if n <> 1 then raise exception 'FAIL queue message=%', n; end if;
  begin
    insert into studio.jobs (user_id, project_id, kind, status) values ('aaaaaaaa-0000-0000-0000-000000000001', p, 'analyze', 'running');
    raise exception 'FAIL second active job';
  exception when unique_violation then null; end;
end $$;

-- 5) 경로 위조: source_path를 다른 작업물 경로로 바꾸면 invalid_source(객체가 있어도), URL 원본도 거부
do $$
declare p2 uuid := '11111111-0000-0000-0000-0000000000a2'; p3 uuid := '11111111-0000-0000-0000-0000000000a3';
begin
  insert into studio.projects (id, user_id, type, source_path) values
    (p2, 'aaaaaaaa-0000-0000-0000-000000000001', 'video', (select v from t9 where k = 'path1')),
    (p3, 'aaaaaaaa-0000-0000-0000-000000000001', 'video', null);
  update studio.projects set source_url = 'https://youtube.com/shorts/x' where id = p3;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
begin
  if studio.start_analyze('11111111-0000-0000-0000-0000000000a2', 'own')->>'result' <> 'invalid_source' then raise exception 'FAIL forged path'; end if;
  if studio.start_analyze('11111111-0000-0000-0000-0000000000a3', 'own')->>'result' <> 'invalid_source' then raise exception 'FAIL url source'; end if;
end $$;

-- 6) 남의 작업물·남의 job: not_found
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
do $$
begin
  if studio.start_analyze((select v from t9 where k = 'p1')::uuid, 'own')->>'result' <> 'not_found' then raise exception 'FAIL other start'; end if;
  if studio.cancel_analyze((select v from t9 where k = 'j1')::uuid) <> 'not_found' then raise exception 'FAIL other cancel'; end if;
end $$;

-- 7) 잔액 부족(B 0크레딧): 잡·작업물 상태 그대로
do $$
declare r jsonb; p uuid; n int;
begin
  r := studio.create_project('video','ko','keep','mp4');
  p := (r->>'project_id')::uuid;
  insert into storage.objects (bucket_id, name) values ('sources', r->>'source_path');
  r := studio.start_analyze(p, 'own');
  if r->>'result' <> 'insufficient_credits' then raise exception 'FAIL insufficient %', r; end if;
  select count(*) into n from studio.jobs where project_id = p;
  if n <> 0 then raise exception 'FAIL job left after insufficient'; end if;
  select count(*) into n from studio.projects where id = p and status = 'draft' and license_type is null;
  if n <> 1 then raise exception 'FAIL project changed after insufficient'; end if;
end $$;

-- 7b) 큐 전송 실패 주입(B에 1크레딧): 함수 전체가 롤백 -> 잔액·jobs·job_steps·projects 그대로
reset role;
select studio.grant_credits('bbbbbbbb-0000-0000-0000-000000000002', 1, 'gift', 't9-b');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
do $$
declare p uuid; bal0 bigint; bal1 bigint; j0 int; j1 int; s0 int; s1 int; st0 text; st1 text; r jsonb;
begin
  select id into p from studio.projects where user_id = auth.uid();
  select coalesce(sum(delta), 0) into bal0 from studio.credit_ledger;
  select count(*) into j0 from studio.jobs;
  select count(*) into s0 from studio.job_steps;
  select status || ':' || coalesce(license_type, '-') || ':' || coalesce(rights_confirmed_at::text, '-') into st0 from studio.projects where id = p;
  perform set_config('test.pgmq_fail', 'on', true);
  begin
    perform studio.start_analyze(p, 'own');
    raise exception 'FAIL start succeeded despite pgmq failure';
  exception when others then
    if sqlerrm not like 'stub: pgmq send failed%' then raise; end if;
  end;
  perform set_config('test.pgmq_fail', 'off', true);
  select coalesce(sum(delta), 0) into bal1 from studio.credit_ledger;
  select count(*) into j1 from studio.jobs;
  select count(*) into s1 from studio.job_steps;
  select status || ':' || coalesce(license_type, '-') || ':' || coalesce(rights_confirmed_at::text, '-') into st1 from studio.projects where id = p;
  if bal0 <> 1 or bal1 <> bal0 or j1 <> j0 or s1 <> s0 or st1 <> st0 then
    raise exception 'FAIL pgmq rollback bal %->% jobs %->% steps %->% project %->%', bal0, bal1, j0, j1, s0, s1, st0, st1;
  end if;
  -- 스위치를 끄면 정상 시작
  r := studio.start_analyze(p, 'own');
  if r->>'result' <> 'ok' then raise exception 'FAIL start after pgmq recovery %', r; end if;
end $$;

-- 8) 동시 한도 2: A가 두 번째 시작 ok, 세 번째 concurrency_limit
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare r jsonb; i int; p uuid; res text[] := '{}';
begin
  for i in 1..2 loop
    r := studio.create_project('video','ko','keep','webm');
    p := (r->>'project_id')::uuid;
    insert into storage.objects (bucket_id, name) values ('sources', r->>'source_path');
    insert into t9 values ('q' || i, p::text);
    res := res || (studio.start_analyze(p, 'own')->>'result');
  end loop;
  if res <> array['ok','concurrency_limit'] then raise exception 'FAIL concurrency %', res; end if;
end $$;

-- 9) 취소: 대기 중 -> ok·환불·draft, 다시 취소 not_cancelable, 다시 시작 가능
do $$
declare p uuid := (select v from t9 where k = 'p1'); j uuid := (select v from t9 where k = 'j1'); n int; bal int; r jsonb;
begin
  if studio.cancel_analyze(j) <> 'ok' then raise exception 'FAIL cancel'; end if;
  select count(*) into n from studio.jobs where id = j and status = 'canceled' and finished_at is not null;
  if n <> 1 then raise exception 'FAIL job not canceled'; end if;
  select count(*) into n from studio.credit_ledger where job_id = j and reason = 'refund' and delta = 1;
  if n <> 1 then raise exception 'FAIL refund rows=%', n; end if;
  select count(*) into n from studio.projects where id = p and status = 'draft';
  if n <> 1 then raise exception 'FAIL project not draft'; end if;
  if studio.cancel_analyze(j) <> 'not_cancelable' then raise exception 'FAIL cancel twice'; end if;
  select sum(delta) into bal from studio.credit_ledger;
  if bal <> 2 then raise exception 'FAIL balance after cancel=%', bal; end if;   -- 3 - 1(p1) - 1(q1) + 1(환불)
  r := studio.start_analyze(p, 'own');
  if r->>'result' <> 'ok' then raise exception 'FAIL restart %', r; end if;
  insert into t9 values ('j2', r->>'job_id');
end $$;

-- 10) 3단계 시작 후 취소 거부(워커가 started_at 기록한 상태), 환불 없음
reset role;
update studio.jobs set status = 'running' where id = (select v from t9 where k = 'j2')::uuid;
update studio.job_steps set started_at = now() where job_id = (select v from t9 where k = 'j2')::uuid and step_no = 3;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare j uuid := (select v from t9 where k = 'j2'); n int;
begin
  if studio.cancel_analyze(j) <> 'too_late' then raise exception 'FAIL cancel after step3'; end if;
  select count(*) into n from studio.credit_ledger where job_id = j and reason = 'refund';
  if n <> 0 then raise exception 'FAIL refund after too_late'; end if;
end $$;

-- 11) 하루 상한 20: 오늘 만든 analyze 잡이 20개면 daily_limit
reset role;
do $$
declare q2 uuid := (select v from t9 where k = 'q2');
begin
  update studio.jobs set status = 'done' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  update studio.projects set status = 'draft' where id = q2;
  insert into studio.jobs (user_id, project_id, kind, status)
    select 'aaaaaaaa-0000-0000-0000-000000000001', (select v from t9 where k = 'q1')::uuid, 'analyze', 'done' from generate_series(1, 17);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare n int;
begin
  select count(*) into n from studio.jobs where kind = 'analyze';
  if n <> 20 then raise exception 'FAIL setup jobs=%', n; end if;
  if studio.start_analyze((select v from t9 where k = 'q2')::uuid, 'own')->>'result' <> 'daily_limit' then raise exception 'FAIL daily limit'; end if;
end $$;
rollback;
\echo PASS 09_studio_analyze
