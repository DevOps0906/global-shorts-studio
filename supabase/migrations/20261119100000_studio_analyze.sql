-- task-006a 분석 시작(DB): 원본 버킷·작업물 생성·분석 시작/취소 definer 함수. 근거 tasks/task-006.md "계획 수정" 1~4·6.
-- 전제: 원격 studio.projects 0행. 크레딧 금액은 PLAN 13-3(분석 1). 큐 메시지 형식은 PLAN 13-4.
-- 웹(authenticated)은 projects·drafts·jobs를 직접 쓰지 않는다. 생성·시작·취소는 아래 함수만, 차감·환불도 함수 안에서만.

-- ============ projects·job_steps 보강 ============
alter table studio.projects
  add column license_type text check (license_type in ('own','permission','license','etc')),
  add constraint projects_length_preset_check check (length_preset in ('keep','short','mid','long'));
comment on column studio.projects.license_type is '권리 유형(PLAN 7-3: 직접 촬영/허락/라이선스/기타). start_analyze만 기록.';

alter table studio.job_steps
  add column started_at timestamptz,
  add column error_code text;
comment on column studio.job_steps.started_at is '단계 시작 시각(4-3 소요 초). done_at과 함께 워커가 기록.';

-- 같은 작업물의 분석은 동시에 1개만
create unique index jobs_one_active_analyze on studio.jobs (project_id)
  where kind = 'analyze' and status in ('queued', 'running');
-- 동시 한도·하루 상한 집계용
create index jobs_user_kind_created_idx on studio.jobs (user_id, kind, created_at);

-- ============ 사용자 직접 쓰기 축소 ============
-- projects: 생성은 create_project()만(원본 경로를 서버가 정한다). lang·length_preset 수정은 유지.
revoke insert on studio.projects from authenticated;
-- drafts: version 1은 워커(service_role)만 만든다. 이후 PATCH는 task-007.
revoke insert on studio.drafts from authenticated;

-- ============ Realtime: 진행 화면이 jobs 상태도 구독(RLS가 구독자별로 적용) ============
alter publication supabase_realtime add table studio.jobs;

-- ============ Storage: 원본 버킷(비공개, 500MB, 영상 3형식) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('sources', 'sources', false, 524288000, array['video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 업로드: 승인된 본인이, 본인 폴더의, create_project()가 정한 경로(아직 draft인 작업물)에만. 덮어쓰기(update)·삭제 정책 없음.
create policy sources_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sources'
    and (select studio.is_approved())
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from studio.projects p
      where p.user_id = (select auth.uid()) and p.source_path = objects.name
        and p.status = 'draft' and p.deleted_at is null
    )
  );
create policy sources_select_own on storage.objects for select to authenticated
  using (
    bucket_id = 'sources'
    and (select studio.is_approved())
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  );

-- ============ 함수 ============
-- 작업물 생성. 원본 경로 = {uid}/{project_id}/source.{ext}. 하루(KST) 30개 상한.
-- 반환 jsonb: { result: ok | not_approved | invalid_request | daily_limit, project_id?, source_path? }
create function studio.create_project(p_type text, p_lang text, p_length text, p_ext text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid := gen_random_uuid(); v_path text; v_n int;
begin
  if v_uid is null or not studio.is_approved() then return jsonb_build_object('result', 'not_approved'); end if;
  if p_type is null or p_type not in ('video','script') or p_lang is null or p_lang not in ('ko','ja','both')
    or p_length is null or p_length not in ('keep','short','mid','long') or p_ext is null or p_ext not in ('mp4','mov','webm') then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('studio.projects:' || v_uid::text, 0));
  select count(*) into v_n from studio.projects
    where user_id = v_uid and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  if v_n >= 30 then return jsonb_build_object('result', 'daily_limit'); end if;
  v_path := v_uid::text || '/' || v_id::text || '/source.' || p_ext;
  insert into studio.projects (id, user_id, type, lang, length_preset, source_path)
    values (v_id, v_uid, p_type, p_lang, p_length, v_path);
  return jsonb_build_object('result', 'ok', 'project_id', v_id, 'source_path', v_path);
end $$;

-- 분석 시작: 한 트랜잭션에서 소유 → 승인 → 원본 → 권리 → 진행 중 → 동시 한도 2 → 하루 20회 → 잔액 → jobs·job_steps → 차감 → 큐.
-- 사용자 크레딧 잠금(spend_credits와 같은 키)을 먼저 쥐어 같은 사용자의 시작·차감을 줄 세운다.
-- 반환 jsonb: { result: ok | not_approved | not_found | invalid_state | source_missing | invalid_source | rights_not_confirmed
--   | already_running | concurrency_limit | daily_limit | insufficient_credits, job_id? }
create function studio.start_analyze(p_project uuid, p_license text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c_cost constant int := 1;   -- PLAN 13-3 분석 1크레딧
  v_uid uuid := auth.uid(); v_p studio.projects; v_job uuid := gen_random_uuid(); v_key text; v_n int; v_bal bigint; v_r text;
begin
  if v_uid is null or not studio.is_approved() then return jsonb_build_object('result', 'not_approved'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select * into v_p from studio.projects where id = p_project and user_id = v_uid and deleted_at is null for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;

  select id into v_job from studio.jobs
    where project_id = p_project and kind = 'analyze' and status in ('queued','running') limit 1;
  if found then return jsonb_build_object('result', 'already_running', 'job_id', v_job); end if;
  v_job := gen_random_uuid();
  if v_p.status not in ('draft','failed') then return jsonb_build_object('result', 'invalid_state'); end if;

  -- 원본: 서버가 정한 경로 형식 + 실제 업로드된 객체. URL 원본은 이번 범위에서 거부.
  if v_p.source_path is null or v_p.source_path !~ ('^' || v_uid::text || '/' || p_project::text || '/source\.(mp4|mov|webm)$') then
    return jsonb_build_object('result', 'invalid_source');
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'sources' and o.name = v_p.source_path) then
    return jsonb_build_object('result', 'source_missing');
  end if;

  -- 권리(PLAN 7-3): 유형 필수. 누락은 정책 감시 기록(작업물당 1건)을 남기고 거부.
  if p_license is null or p_license not in ('own','permission','license','etc') then
    if not exists (select 1 from studio.policy_flags f where f.project_id = p_project and f.type = 'no_rights') then
      insert into studio.policy_flags (user_id, project_id, type) values (v_uid, p_project, 'no_rights');
    end if;
    return jsonb_build_object('result', 'rights_not_confirmed');
  end if;

  select count(*) into v_n from studio.jobs where user_id = v_uid and kind = 'analyze' and status in ('queued','running');
  if v_n >= 2 then return jsonb_build_object('result', 'concurrency_limit'); end if;
  select count(*) into v_n from studio.jobs
    where user_id = v_uid and kind = 'analyze'
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  if v_n >= 20 then return jsonb_build_object('result', 'daily_limit'); end if;
  select coalesce(sum(delta), 0) into v_bal from studio.credit_ledger where user_id = v_uid;
  if v_bal < c_cost then return jsonb_build_object('result', 'insufficient_credits'); end if;

  update studio.projects set status = 'analyzing', rights_confirmed_at = now(), license_type = p_license where id = p_project;
  insert into studio.jobs (id, user_id, project_id, kind, status, cost_credits)
    values (v_job, v_uid, p_project, 'analyze', 'queued', c_cost);
  insert into studio.job_steps (job_id, user_id, step_no, label)
    select v_job, v_uid, s.no, s.label
    from (values (1, '영상 확인'), (2, '장면 분석'), (3, '제목·대본 생성'), (4, '편집 마무리')) as s(no, label);
  v_key := v_job::text || ':spend:1';
  v_r := studio.spend_credits(v_uid, c_cost, v_job, v_key, 1);
  if v_r <> 'ok' then raise exception 'start_analyze: spend_credits returned %', v_r; end if;   -- 잠금 안이라 일어나면 버그
  perform pgmq.send('analyze', jsonb_build_object('job_id', v_job, 'project_id', p_project, 'kind', 'analyze', 'idempotency_key', v_key));
  return jsonb_build_object('result', 'ok', 'job_id', v_job);
end $$;

-- 분석 취소(PLAN 4-3·13-3): 3단계(제목·대본 생성) 시작 전이면 canceled + 환불, 작업물은 draft로 되돌린다.
-- 워커는 3단계 시작 시 같은 jobs 행을 for update로 잠그고 status='running'을 다시 확인한 뒤 job_steps(3).started_at을 기록해야 한다.
-- 반환: ok · not_approved · not_found · not_cancelable(이미 끝남) · too_late(3단계 시작됨)
create function studio.cancel_analyze(p_job uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_j studio.jobs; v_r text;
begin
  if v_uid is null or not studio.is_approved() then return 'not_approved'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select * into v_j from studio.jobs where id = p_job and user_id = v_uid and kind = 'analyze' for update;
  if not found then return 'not_found'; end if;
  if v_j.status not in ('queued','running') then return 'not_cancelable'; end if;
  if exists (select 1 from studio.job_steps s where s.job_id = p_job and s.step_no >= 3
             and (s.started_at is not null or s.done_at is not null)) then
    return 'too_late';
  end if;
  update studio.jobs set status = 'canceled', finished_at = now() where id = p_job;
  update studio.projects set status = 'draft' where id = v_j.project_id and status = 'analyzing';
  v_r := studio.refund_credits(v_uid, coalesce(v_j.cost_credits, 1), p_job, v_j.attempt_no,
    p_job::text || ':refund:' || v_j.attempt_no);
  if v_r not in ('ok','duplicate','no_charge') then raise exception 'cancel_analyze: refund_credits returned %', v_r; end if;
  return 'ok';
end $$;

revoke execute on function studio.create_project(text, text, text, text), studio.start_analyze(uuid, text),
  studio.cancel_analyze(uuid) from public, anon, authenticated;
grant execute on function studio.create_project(text, text, text, text), studio.start_analyze(uuid, text),
  studio.cancel_analyze(uuid) to authenticated, service_role;
