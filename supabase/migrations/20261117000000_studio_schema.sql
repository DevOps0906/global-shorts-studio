-- 글로벌쇼츠 스튜디오 DB (기획서 6-2·11-5·13-3·13-5). 이 앱 전용 Supabase 프로젝트 가정.
-- 이번 범위 밖(해당 task에서 추가): analysis, variants, tts_clips, renders, uploads, style_presets, radar.videos/video_snapshots.
create schema if not exists radar;
create schema if not exists studio;

-- 권한 기본값: 두 스키마는 명시한 것만 연다. anon은 아무것도 없다.
grant usage on schema studio, radar to authenticated, service_role;
alter default privileges in schema studio, radar revoke all on tables from public, anon, authenticated;
alter default privileges in schema studio, radar grant all on tables to service_role;
alter default privileges in schema studio, radar grant all on sequences to service_role;
alter default privileges in schema studio, radar revoke execute on functions from public, anon, authenticated;

-- ============ 역할·코호트 (13-5, 11-6) ============
create table studio.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('member','instructor','operator')),
  plan text not null default 'free',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table studio.profiles is '역할·플랜. 운영자/강사 판정의 유일한 근거. 쓰기는 service_role만.';

create table studio.cohort_members (
  cohort_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student','instructor')),
  primary key (cohort_id, user_id)
);
create index cohort_members_user_idx on studio.cohort_members (user_id, role);
comment on table studio.cohort_members is '강사가 볼 수 있는 수강생 범위. 쓰기는 service_role만.';

-- 가입 시 profiles 자동 생성(role=member). 이후 role 변경은 service_role만.
create function studio.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into studio.profiles (user_id, role) values (new.id, 'member') on conflict do nothing;
  return new;
end $$;
revoke execute on function studio.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function studio.handle_new_user();

-- 판정 함수: 인자로 남의 권한을 얻을 수 없다(운영자는 auth.uid() 고정, 강사는 대상 uid만 인자).
create function studio.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from studio.profiles p where p.user_id = (select auth.uid()) and p.role = 'operator');
$$;
create function studio.is_instructor_of(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from studio.cohort_members i
    join studio.cohort_members s on s.cohort_id = i.cohort_id and s.role = 'student'
    where i.user_id = (select auth.uid()) and i.role = 'instructor' and s.user_id = uid
  );
$$;
revoke execute on function studio.is_operator(), studio.is_instructor_of(uuid) from public, anon, authenticated;
grant execute on function studio.is_operator(), studio.is_instructor_of(uuid) to authenticated, service_role;

-- ============ 레이더 ============
create table radar.channels (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  name text,
  grp text not null default 'ref' check (grp in ('ref','ref200')),
  subs bigint,
  tracking boolean not null default true,
  last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, handle)
);
comment on table radar.channels is '저장 채널. 본인 행만 읽기·쓰기.';

-- ============ 작업물·초안·작업 ============
create table studio.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('video','script')),
  lang text not null default 'ko' check (lang in ('ko','ja','both')),
  length_preset text not null default 'keep',
  source_video_id bigint,            -- radar.videos(id) 연결(해당 테이블 추가 task에서 FK)
  source_path text check (source_path is null or source_path like user_id::text || '/%'),  -- 본인 폴더만. 원본 삭제는 워커가 Storage API로 한다(SQL로 객체 삭제 금지).
  source_sha256 text,
  source_url text,                   -- 형식·도메인 검증은 워커가 한다.
  source_deleted_at timestamptz,
  status text not null default 'draft',
  rights_confirmed_at timestamptz,
  transform_score int check (transform_score between 0 and 100),
  finished_at timestamptz,
  deleted_at timestamptz,            -- 소프트 삭제(서버만). 위반 기록 보존을 위해 행을 지우지 않는다.
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index projects_user_idx on studio.projects (user_id);
create index projects_source_cleanup_idx on studio.projects (finished_at) where source_deleted_at is null;
comment on table studio.projects is '작업물(영상 1개). 본인 행 읽기, 일부 컬럼만 직접 쓰기.';

create table studio.drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  version int not null default 1,
  edit_state jsonb,
  selected_title text,
  selected_script text,
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references studio.projects (id, user_id) on delete cascade,
  unique (project_id, version)
);
create index drafts_user_idx on studio.drafts (user_id);
comment on table studio.drafts is '편집 초안. PATCH는 version 일치할 때만(서버).';

create table studio.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  kind text not null check (kind in ('analyze','tts','render','translate','scan')),
  status text not null default 'queued' check (status in ('queued','running','done','failed','canceled')),
  step_name text,
  attempt_no int not null default 1 check (attempt_no >= 1),  -- 재시도 = 같은 job, attempt_no + 1
  started_at timestamptz,
  finished_at timestamptz,
  model text,
  cost_credits int,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references studio.projects (id, user_id) on delete cascade
);
create index jobs_user_idx on studio.jobs (user_id);
create index jobs_project_idx on studio.jobs (project_id);
comment on table studio.jobs is '워커 작업. 본인(·강사 코호트·운영자) 읽기만, 쓰기는 서버.';

create table studio.job_steps (
  id bigint generated always as identity primary key,
  job_id uuid not null,
  user_id uuid not null,
  step_no int not null,
  label text not null,
  done_at timestamptz,
  foreign key (job_id, user_id) references studio.jobs (id, user_id) on delete cascade
);
create index job_steps_job_idx on studio.job_steps (job_id);
create index job_steps_user_idx on studio.job_steps (user_id);
comment on table studio.job_steps is '진행 단계(Realtime 구독 대상). 본인 읽기만.';

-- ============ 설정·계정·숙제·문의 ============
create table studio.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'ko', preset text not null default 'brand', length text not null default 'keep',
  notify_tg boolean not null default true, notify_mail boolean not null default false,
  big_text boolean not null default false, autosave boolean not null default true, warn_low_score boolean not null default true
);
comment on table studio.user_settings is '설정 화면. 본인 행만 읽기·쓰기.';

create table studio.linked_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube_kr','youtube_jp','threads','telegram')),
  token_ref text,   -- Vault 참조. 서버 함수만 기록. 조회 시 vault.secrets.name = 'oauth:'||user_id||':'||provider 인지 반드시 확인.
  status text not null default 'connected',
  unique (user_id, provider)
);
comment on table studio.linked_accounts is '연결 계정. 본인은 token_ref 제외 컬럼만 읽기.';

create function studio.delete_linked_account_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where name = 'oauth:' || old.user_id || ':' || old.provider;
  return old;
end $$;
revoke execute on function studio.delete_linked_account_secret() from public, anon, authenticated;
create trigger linked_accounts_delete_secret after delete on studio.linked_accounts
  for each row execute function studio.delete_linked_account_secret();

-- token_ref는 같은 사용자·provider 이름의 vault 비밀만 가리킬 수 있다(남의 비밀 참조 차단).
create function studio.check_linked_account_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.token_ref is not null and not exists (
    select 1 from vault.secrets s
    where s.id::text = new.token_ref and s.name = 'oauth:' || new.user_id || ':' || new.provider
  ) then
    raise exception 'token_ref does not match vault secret oauth:<user_id>:<provider>';
  end if;
  return new;
end $$;
revoke execute on function studio.check_linked_account_token() from public, anon, authenticated;
create trigger linked_accounts_check_token before insert or update on studio.linked_accounts
  for each row execute function studio.check_linked_account_token();

create table studio.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('job','charge','gift','refund')),
  job_id uuid,
  attempt_no int,
  idempotency_key text not null unique,   -- job_id:action:attempt_no
  created_at timestamptz not null default now(),
  foreign key (job_id, user_id) references studio.jobs (id, user_id) on delete set null (job_id),
  check ((reason = 'job' and delta < 0) or (reason in ('charge','gift','refund') and delta > 0))
);
create index credit_ledger_user_idx on studio.credit_ledger (user_id);
create index credit_ledger_job_idx on studio.credit_ledger (job_id);
create unique index credit_ledger_refund_once on studio.credit_ledger (job_id, attempt_no) where reason = 'refund';
comment on table studio.credit_ledger is '크레딧 원장(추가 전용). 기록은 아래 DB 함수로만.';

create table studio.homework_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_no int not null check (lesson_no between 1 and 5),
  rule_key text not null, done_at timestamptz,
  unique (user_id, lesson_no, rule_key)
);
comment on table studio.homework_progress is '숙제 자동 판정. 본인·강사 읽기만, 쓰기는 서버.';

create table studio.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug','pay','idea','etc')),
  body text not null check (char_length(body) <= 5000), status text not null default 'wait', answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_tickets_user_idx on studio.support_tickets (user_id);
comment on table studio.support_tickets is '고객문의. 본인은 작성·읽기만(상태·답변은 서버).';

create table studio.policy_flags (
  id bigint generated always as identity primary key,
  job_id uuid references studio.jobs(id) on delete set null,
  user_id uuid not null,       -- 값 복사 보관(FK 없음): 계정·작업이 지워져도 위반 기록은 남는다.
  project_id uuid,             -- 위와 같음
  type text not null check (type in ('low_score','repeat_source','no_rights')),
  sent_at timestamptz
);
create index policy_flags_job_idx on studio.policy_flags (job_id);
comment on table studio.policy_flags is '정책 감시. 운영자만 읽기.';

create table studio.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,   -- 운영자 계정이 지워져도 감사 기록은 보존
  action text not null, target text, at timestamptz not null default now()
);
create index admin_audit_log_admin_idx on studio.admin_audit_log (admin_id);
comment on table studio.admin_audit_log is '관리 행동 기록. 운영자만 읽기, 쓰기는 서버.';

-- ============ 크레딧 함수 (13-3): 잔액 확인과 기록을 한 트랜잭션, 사용자별 advisory lock ============
create function studio.spend_credits(p_user uuid, p_amount int, p_job uuid, p_key text, p_attempt int default 1)
returns text language plpgsql security definer set search_path = '' as $$
declare v_balance bigint; v_rows int;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if exists (select 1 from studio.credit_ledger where idempotency_key = p_key) then return 'duplicate'; end if;
  select coalesce(sum(delta), 0) into v_balance from studio.credit_ledger where user_id = p_user;
  if v_balance < p_amount then return 'insufficient'; end if;
  insert into studio.credit_ledger (user_id, delta, reason, job_id, attempt_no, idempotency_key)
    values (p_user, -p_amount, 'job', p_job, p_attempt, p_key)
    on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'duplicate' end;
end $$;

create function studio.grant_credits(p_user uuid, p_amount int, p_reason text, p_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_rows int;
begin
  if p_reason not in ('charge','gift') then raise exception 'reason must be charge or gift'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  insert into studio.credit_ledger (user_id, delta, reason, idempotency_key)
    values (p_user, p_amount, p_reason, p_key)
    on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'duplicate' end;
end $$;

-- 환불: 차감이 있었던 (user, job, attempt)만, 차감액 이내로, 키가 달라도 한 번만(부분 unique).
create function studio.refund_credits(p_user uuid, p_amount int, p_job uuid, p_attempt int, p_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_rows int; v_charged bigint;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_job is null or p_attempt is null then raise exception 'job and attempt required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  -- 같은 user·job·attempt의 차감액을 넘는 환불은 거부
  select coalesce(-sum(delta), 0) into v_charged from studio.credit_ledger
    where user_id = p_user and job_id = p_job and attempt_no = p_attempt and reason = 'job';
  if v_charged = 0 then return 'no_charge'; end if;
  if p_amount > v_charged then return 'over_refund'; end if;
  insert into studio.credit_ledger (user_id, delta, reason, job_id, attempt_no, idempotency_key)
    values (p_user, p_amount, 'refund', p_job, p_attempt, p_key)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'duplicate' end;
end $$;

revoke execute on function studio.spend_credits(uuid,int,uuid,text,int), studio.grant_credits(uuid,int,text,text),
  studio.refund_credits(uuid,int,uuid,int,text) from public, anon, authenticated;
grant execute on function studio.spend_credits(uuid,int,uuid,text,int), studio.grant_credits(uuid,int,text,text),
  studio.refund_credits(uuid,int,uuid,int,text) to service_role;

-- ============ 강사용 작업 큐 뷰 (C5): 최소 컬럼. 소유자 권한으로 읽고 WHERE로 범위를 건다(jobs 직접 열람은 불가). ============
create view studio.instructor_job_queue as
  select id, user_id, kind, status, created_at
  from studio.jobs
  where studio.is_instructor_of(user_id) or studio.is_operator();

-- ============ RLS ============
alter table radar.channels enable row level security;
alter table studio.profiles enable row level security;
alter table studio.cohort_members enable row level security;
alter table studio.projects enable row level security;
alter table studio.drafts enable row level security;
alter table studio.jobs enable row level security;
alter table studio.job_steps enable row level security;
alter table studio.user_settings enable row level security;
alter table studio.linked_accounts enable row level security;
alter table studio.credit_ledger enable row level security;
alter table studio.homework_progress enable row level security;
alter table studio.support_tickets enable row level security;
alter table studio.policy_flags enable row level security;
alter table studio.admin_audit_log enable row level security;

-- 본인 행 읽기·쓰기
create policy own_rows on radar.channels for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on studio.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on studio.drafts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on studio.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_select on studio.support_tickets for select to authenticated using (user_id = (select auth.uid()));
create policy own_insert on studio.support_tickets for insert to authenticated with check (user_id = (select auth.uid()));

-- 본인 읽기만
create policy own_select on studio.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy operator_select on studio.profiles for select to authenticated using (studio.is_operator());
create policy own_select on studio.cohort_members for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on studio.jobs for select to authenticated using (user_id = (select auth.uid()));
create policy operator_select on studio.jobs for select to authenticated using (studio.is_operator());
create policy own_select on studio.job_steps for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on studio.linked_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on studio.credit_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy operator_select on studio.credit_ledger for select to authenticated using (studio.is_operator());
create policy own_select on studio.homework_progress for select to authenticated using (user_id = (select auth.uid()));
create policy instructor_select on studio.homework_progress for select to authenticated using (studio.is_instructor_of(user_id));

-- 운영자만 읽기
create policy operator_select on studio.policy_flags for select to authenticated using (studio.is_operator());
create policy operator_select on studio.admin_audit_log for select to authenticated using (studio.is_operator());

-- ============ 테이블 권한(최소). 나머지 쓰기는 service_role ============
revoke all on all tables in schema studio, radar from public, anon, authenticated;
grant all on all tables in schema studio, radar to service_role;
grant all on all sequences in schema studio, radar to service_role;

grant select, insert, update, delete on radar.channels, studio.user_settings, studio.drafts to authenticated;
grant select on studio.projects to authenticated;   -- delete 없음: 소프트 삭제는 서버만
grant insert (user_id, type, lang, length_preset, source_video_id, source_path, source_url) on studio.projects to authenticated;
grant update (lang, length_preset) on studio.projects to authenticated;
grant select on studio.profiles, studio.cohort_members, studio.jobs, studio.job_steps, studio.credit_ledger,
  studio.homework_progress, studio.policy_flags, studio.admin_audit_log, studio.support_tickets,
  studio.instructor_job_queue to authenticated;
grant select (id, user_id, provider, status) on studio.linked_accounts to authenticated;   -- token_ref 제외
grant insert (user_id, kind, body) on studio.support_tickets to authenticated;

-- Realtime: job_steps (RLS select 정책이 구독자별로 적용된다)
alter publication supabase_realtime add table studio.job_steps;
