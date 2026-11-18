-- task-005 레이더·저장 채널(원본 지표만). YouTube 개발자 정책 III.E.4.h: API 데이터로 파생 지표를 만들지 않는다(스냅샷 테이블 없음).
-- 전제: 원격 radar.channels 0행(not null 컬럼을 기본값 없이 추가).
-- 쓰기는 모두 아래 definer 함수 경유(auth.uid()·승인 확인). 사용자 직접 쓰기는 channels의 tracking·grp 수정과 삭제만.

-- ============ channels 보강 ============
alter table radar.channels
  add column yt_channel_id text not null check (yt_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  add column uploads_playlist_id text not null check (uploads_playlist_id ~ '^UU[A-Za-z0-9_-]{22}$'),
  add column refreshed_at timestamptz not null default now(),   -- name·subs를 API로 마지막 갱신한 시각(30일 정책)
  add constraint channels_user_yt_key unique (user_id, yt_channel_id),
  add constraint channels_id_user_key unique (id, user_id);
comment on column radar.channels.refreshed_at is 'name·subs 갱신 시각. 30일 넘으면 purge_stale()이 비운다.';

-- 직접 insert·update 회수. 추적 켜기/끄기·그룹 변경만 컬럼 단위로 허용(delete·select 유지)
revoke insert, update on radar.channels from authenticated;
grant update (tracking, grp) on radar.channels to authenticated;

-- ============ 추적 영상 ============
create table radar.videos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id bigint not null,
  yt_video_id text not null check (yt_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  published_at timestamptz not null,
  duration_s int not null check (duration_s >= 0),
  thumbnail_url text,
  views bigint,          -- 원본 값 그대로(비공개면 null)
  likes bigint,
  comments bigint,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, yt_video_id),
  unique (id, user_id),
  foreign key (channel_id, user_id) references radar.channels (id, user_id) on delete cascade
);
create index videos_user_idx on radar.videos (user_id);
create index videos_updated_idx on radar.videos (updated_at);
comment on table radar.videos is '저장 채널의 쇼츠(원본 지표만). 본인 행 읽기만, 쓰기는 radar.upsert_videos().';

-- 작업물 출처 영상: 본인 영상만 연결(복합 FK — 남의 영상 id 확인 불가). 영상이 지워지면 source_video_id만 null, 출처는 source_url로 남는다
alter table studio.projects add constraint projects_source_video_fkey
  foreign key (source_video_id, user_id) references radar.videos (id, user_id) on delete set null (source_video_id);
create index projects_source_video_idx on studio.projects (source_video_id);

-- ============ 쿼터 기록(사용자 쓰기 불가). 날짜는 YouTube 쿼터 기준 America/Los_Angeles ============
create table radar.quota_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  units int not null default 0 check (units >= 0),
  channel_lookups int not null default 0 check (channel_lookups >= 0),
  last_scan_at timestamptz,
  primary key (user_id, day)
);
comment on table radar.quota_usage is '사용자별 하루 YouTube 쿼터 사용량. 본인 행 읽기만, 쓰기는 claim 함수.';

create table radar.quota_global (
  day date primary key,
  units int not null default 0 check (units >= 0)
);
comment on table radar.quota_global is '서비스 전체 하루 YouTube 쿼터 사용량. 사용자 접근 없음.';

-- ============ RLS ============
alter table radar.videos enable row level security;
alter table radar.quota_usage enable row level security;
alter table radar.quota_global enable row level security;

create policy own_select on radar.videos for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on radar.quota_usage for select to authenticated using (user_id = (select auth.uid()));
-- quota_global: 허용 정책 없음(사용자 0행)

create policy approved_only on radar.videos as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on radar.quota_usage as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on radar.quota_global as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));

revoke all on radar.videos, radar.quota_usage, radar.quota_global from public, anon, authenticated;
grant all on radar.videos, radar.quota_usage, radar.quota_global to service_role;
grant select on radar.videos, radar.quota_usage to authenticated;

-- ============ 함수 ============
-- 오늘(쿼터 기준일, LA 자정 초기화)
create function radar.quota_day() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

-- 한도 판정 공통: 사용자 일일 1,000 · 전역 일일 8,000. 호출자는 전역 advisory lock을 쥔 상태여야 한다.
create function radar._quota_check(p_user uuid, p_day date, p_units int) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user int; v_global int;
begin
  select coalesce(units, 0) into v_user from radar.quota_usage where user_id = p_user and day = p_day;
  select units into v_global from radar.quota_global where day = p_day;
  if coalesce(v_global, 0) + p_units > 8000 then return 'quota_exhausted'; end if;
  if coalesce(v_user, 0) + p_units > 1000 then return 'user_daily_limit'; end if;
  return 'ok';
end $$;

-- 사용 기록(한도 확인 뒤 호출)
create function radar._quota_record(p_user uuid, p_day date, p_units int, p_scan boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into radar.quota_global (day, units) values (p_day, p_units)
    on conflict (day) do update set units = radar.quota_global.units + excluded.units;
  insert into radar.quota_usage (user_id, day, units, channel_lookups, last_scan_at)
    values (p_user, p_day, p_units, case when p_scan then 0 else 1 end, case when p_scan then now() end)
    on conflict (user_id, day) do update set
      units = radar.quota_usage.units + excluded.units,
      channel_lookups = radar.quota_usage.channel_lookups + excluded.channel_lookups,
      last_scan_at = coalesce(excluded.last_scan_at, radar.quota_usage.last_scan_at);
end $$;

-- 스캔 시작 전 쿼터 확보: 사용자 10분 간격 + 일일·전역 한도를 한 번에 확인·기록(전역 advisory lock).
-- 반환: ok · not_approved · too_soon · user_daily_limit · quota_exhausted
create function radar.claim_scan(p_units int) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_day date := radar.quota_day(); v_last timestamptz; v_r text;
begin
  if v_uid is null or not studio.is_approved() then return 'not_approved'; end if;
  if p_units is null or p_units < 1 or p_units > 200 then raise exception 'units out of range'; end if;
  perform pg_advisory_xact_lock(hashtextextended('radar.quota', 0));
  select max(last_scan_at) into v_last from radar.quota_usage where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '10 minutes' then return 'too_soon'; end if;
  v_r := radar._quota_check(v_uid, v_day, p_units);
  if v_r <> 'ok' then return v_r; end if;
  perform radar._quota_record(v_uid, v_day, p_units, true);
  return 'ok';
end $$;

-- 채널 확인(channels.list 1유닛) 전 쿼터 확보: 일일 확인 50회 상한 + 일일·전역 한도.
-- 반환: ok · not_approved · lookup_limit · channel_limit · user_daily_limit · quota_exhausted
create function radar.claim_lookup() returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_day date := radar.quota_day(); v_n int; v_r text;
begin
  if v_uid is null or not studio.is_approved() then return 'not_approved'; end if;
  perform pg_advisory_xact_lock(hashtextextended('radar.quota', 0));
  select count(*) into v_n from radar.channels where user_id = v_uid;
  if v_n >= 50 then return 'channel_limit'; end if;
  select coalesce(channel_lookups, 0) into v_n from radar.quota_usage where user_id = v_uid and day = v_day;
  if coalesce(v_n, 0) >= 50 then return 'lookup_limit'; end if;
  v_r := radar._quota_check(v_uid, v_day, 1);
  if v_r <> 'ok' then return v_r; end if;
  perform radar._quota_record(v_uid, v_day, 1, false);
  return 'ok';
end $$;

-- 채널 저장: 사용자 50개 상한(사용자 잠금). 반환: ok · not_approved · channel_limit · duplicate
create function radar.add_channel(p_handle text, p_name text, p_yt_channel_id text, p_uploads_playlist_id text,
  p_subs bigint, p_grp text default 'ref') returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_rows int;
begin
  if v_uid is null or not studio.is_approved() then return 'not_approved'; end if;
  perform pg_advisory_xact_lock(hashtextextended('radar.channels:' || v_uid::text, 0));
  if (select count(*) from radar.channels where user_id = v_uid) >= 50 then return 'channel_limit'; end if;
  insert into radar.channels (user_id, handle, name, yt_channel_id, uploads_playlist_id, subs, grp, refreshed_at)
    values (v_uid, p_handle, p_name, p_yt_channel_id, p_uploads_playlist_id, p_subs, coalesce(p_grp, 'ref'), now())
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'duplicate' end;
end $$;

-- 스캔 결과 저장: 본인 채널만, 한 번에 최대 50개. 썸네일은 i.ytimg.com만(아니면 null). name·subs를 주면 채널 정보도 갱신. 반환: 저장 행 수
create function radar.upsert_videos(p_channel_id bigint, p_videos jsonb, p_name text default null, p_subs bigint default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_rows int;
begin
  if v_uid is null or not studio.is_approved() then raise exception 'not approved' using errcode = '42501'; end if;
  if not exists (select 1 from radar.channels where id = p_channel_id and user_id = v_uid) then
    raise exception 'channel not found' using errcode = '42501';
  end if;
  if jsonb_typeof(p_videos) <> 'array' or jsonb_array_length(p_videos) > 50 then
    raise exception 'videos must be an array of at most 50';
  end if;
  insert into radar.videos (user_id, channel_id, yt_video_id, title, published_at, duration_s, thumbnail_url, views, likes, comments)
    select v_uid, p_channel_id, v.yt_video_id, v.title, v.published_at, v.duration_s,
      case when v.thumbnail_url ~ '^https://i\.ytimg\.com/' then v.thumbnail_url end, v.views, v.likes, v.comments
    from jsonb_to_recordset(p_videos) as v(yt_video_id text, title text, published_at timestamptz, duration_s int,
      thumbnail_url text, views bigint, likes bigint, comments bigint)
  on conflict (channel_id, yt_video_id) do update set
    title = excluded.title, published_at = excluded.published_at, duration_s = excluded.duration_s,
    thumbnail_url = excluded.thumbnail_url, views = excluded.views, likes = excluded.likes,
    comments = excluded.comments, updated_at = now();
  get diagnostics v_rows = row_count;
  update radar.channels set
    last_scan_at = now(),
    name = coalesce(p_name, name),
    subs = case when p_name is not null then p_subs else subs end,
    refreshed_at = case when p_name is not null then now() else refreshed_at end
  where id = p_channel_id and user_id = v_uid;
  return v_rows;
end $$;

-- 30일 정책(YouTube API 데이터 보관): 30일 넘게 갱신 안 된 영상 삭제, 채널 name·subs 비움. pg_cron이 매일 호출.
create function radar.purge_stale() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from radar.videos where updated_at < now() - interval '30 days';
  update radar.channels set name = null, subs = null
    where refreshed_at < now() - interval '30 days' and (name is not null or subs is not null);
end $$;

revoke execute on function radar.quota_day(), radar._quota_check(uuid, date, int), radar._quota_record(uuid, date, int, boolean),
  radar.claim_scan(int), radar.claim_lookup(),
  radar.add_channel(text, text, text, text, bigint, text), radar.upsert_videos(bigint, jsonb, text, bigint),
  radar.purge_stale() from public, anon, authenticated;
grant execute on function radar.claim_scan(int), radar.claim_lookup(),
  radar.add_channel(text, text, text, text, bigint, text), radar.upsert_videos(bigint, jsonb, text, bigint)
  to authenticated, service_role;
grant execute on function radar.quota_day(), radar.purge_stale() to service_role;

-- pg_cron이 있는 환경(원격 Supabase)에서만 매일 정리 예약. 로컬 테스트 컨테이너에는 없어 건너뛴다.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $q$select cron.schedule('radar-purge-stale', '17 11 * * *', 'select radar.purge_stale()')$q$;
  end if;
end $$;
