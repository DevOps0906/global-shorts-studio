-- 글로벌쇼츠 스튜디오 DB 초안 (기획서 6·11장). 적용 전 검토 필요.
create schema if not exists radar;
create schema if not exists studio;

-- 저장 채널 (radar)
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

-- 작업 (영상 1개 = job 1개)
create table studio.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('video','script')),
  lang text not null default 'ko' check (lang in ('ko','ja','both')),
  source_url text,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  edit_state jsonb,
  transform_score int,
  created_at timestamptz not null default now()
);
create table studio.job_steps (
  id bigint generated always as identity primary key,
  job_id uuid not null references studio.jobs(id) on delete cascade,
  step_no int not null,
  label text not null,
  done_at timestamptz
);

create table studio.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'ko', preset text not null default 'brand', length text not null default 'keep',
  notify_tg boolean not null default true, notify_mail boolean not null default false,
  big_text boolean not null default false, autosave boolean not null default true, warn_low_score boolean not null default true
);
create table studio.linked_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube_kr','youtube_jp','threads','telegram')),
  token_ref text, status text not null default 'connected',
  unique (user_id, provider)
);
create table studio.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('job','charge','gift','refund')),
  job_id uuid references studio.jobs(id),
  created_at timestamptz not null default now()
);
create table studio.homework_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_no int not null check (lesson_no between 1 and 5),
  rule_key text not null, done_at timestamptz,
  unique (user_id, lesson_no, rule_key)
);
create table studio.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug','pay','idea','etc')),
  body text not null, status text not null default 'wait', answered_at timestamptz,
  created_at timestamptz not null default now()
);
create table studio.policy_flags (
  id bigint generated always as identity primary key,
  job_id uuid not null references studio.jobs(id) on delete cascade,
  type text not null check (type in ('low_score','repeat_source','no_rights')),
  sent_at timestamptz
);
create table studio.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  action text not null, target text, at timestamptz not null default now()
);

-- 본인 데이터만 접근 (RLS). 관리자 정책은 역할(RBAC) 구현 후 추가.
alter table radar.channels enable row level security;
alter table studio.jobs enable row level security;
alter table studio.user_settings enable row level security;
alter table studio.linked_accounts enable row level security;
alter table studio.credit_ledger enable row level security;
alter table studio.homework_progress enable row level security;
alter table studio.support_tickets enable row level security;
create policy own_rows on radar.channels using (user_id = auth.uid());
create policy own_rows on studio.jobs using (user_id = auth.uid());
create policy own_rows on studio.user_settings using (user_id = auth.uid());
create policy own_rows on studio.linked_accounts using (user_id = auth.uid());
create policy own_rows on studio.credit_ledger for select using (user_id = auth.uid());
create policy own_rows on studio.homework_progress using (user_id = auth.uid());
create policy own_rows on studio.support_tickets using (user_id = auth.uid());
