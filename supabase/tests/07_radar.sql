-- 테스트 7: 레이더(task-005). 채널 직접 쓰기 거부·50개 상한·claim 한도·남의 채널 upsert 거부·복합 FK·30일 정리.
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t'),     -- 승인 A
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t'),     -- 승인 B
  ('cccccccc-0000-0000-0000-000000000003', 'c@t'),     -- 승인 C(전역 소진 표시)
  ('dddddddd-0000-0000-0000-000000000004', 'u@t');     -- 미승인
update studio.profiles set approved_at = now() where user_id <> 'dddddddd-0000-0000-0000-000000000004';
insert into radar.channels (id, user_id, handle, yt_channel_id, uploads_playlist_id) overriding system value values
  (900, 'bbbbbbbb-0000-0000-0000-000000000002', '@b', 'UC' || repeat('b', 22), 'UU' || repeat('b', 22));

-- 1) A: 직접 쓰기 거부, tracking·grp만 수정 가능, add_channel 경유 저장·중복
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$
declare r text; cid bigint; n int;
begin
  begin insert into radar.channels (user_id, handle, yt_channel_id, uploads_playlist_id)
    values (auth.uid(), '@x', 'UC' || repeat('x', 22), 'UU' || repeat('x', 22)); raise exception 'FAIL direct channel insert';
  exception when insufficient_privilege then null; end;
  r := radar.add_channel('@a', 'A', 'UC' || repeat('a', 22), 'UU' || repeat('a', 22), 10);
  if r <> 'ok' then raise exception 'FAIL add_channel %', r; end if;
  r := radar.add_channel('@a', 'A', 'UC' || repeat('a', 22), 'UU' || repeat('a', 22), 10);
  if r <> 'duplicate' then raise exception 'FAIL add_channel dup %', r; end if;
  select id into cid from radar.channels where user_id = auth.uid();
  begin update radar.channels set name = 'hack' where id = cid; raise exception 'FAIL name update';
  exception when insufficient_privilege then null; end;
  begin update radar.channels set subs = 1 where id = cid; raise exception 'FAIL subs update';
  exception when insufficient_privilege then null; end;
  begin update radar.channels set user_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = cid; raise exception 'FAIL user_id update';
  exception when insufficient_privilege then null; end;
  update radar.channels set tracking = false, grp = 'ref200' where id = cid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL tracking update=%', n; end if;
  -- 남의 채널 수정·조회 0건
  update radar.channels set tracking = false where id = 900;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL updated B channel'; end if;
  -- 직접 videos 쓰기 거부
  begin insert into radar.videos (user_id, channel_id, yt_video_id, title, published_at, duration_s)
    values (auth.uid(), cid, 'aaaaaaaaaaa', 't', now(), 10); raise exception 'FAIL direct video insert';
  exception when insufficient_privilege then null; end;
  -- 남의 채널에 upsert 거부
  begin perform radar.upsert_videos(900, '[]'::jsonb); raise exception 'FAIL upsert others';
  exception when insufficient_privilege then null; end;
  -- 본인 채널 upsert: 2건 → 같은 영상 재저장은 갱신(행 수 그대로, first_seen_at 유지)
  n := radar.upsert_videos(cid, jsonb_build_array(
    jsonb_build_object('yt_video_id', 'vid00000001', 'title', 'one', 'published_at', now(), 'duration_s', 30, 'views', 100),
    jsonb_build_object('yt_video_id', 'vid00000002', 'title', 'two', 'published_at', now(), 'duration_s', 50, 'views', 5,
      'thumbnail_url', 'https://evil.example/x.jpg')),
    'A renamed', 20);
  if n <> 2 then raise exception 'FAIL upsert count=%', n; end if;
  n := radar.upsert_videos(cid, jsonb_build_array(
    jsonb_build_object('yt_video_id', 'vid00000001', 'title', 'one!', 'published_at', now(), 'duration_s', 30, 'views', 200,
      'thumbnail_url', 'https://i.ytimg.com/vi/vid00000001/hq.jpg')));
  select count(*) into n from radar.videos where yt_video_id = 'vid00000002' and thumbnail_url is null;
  if n <> 1 then raise exception 'FAIL foreign thumbnail kept'; end if;
  select count(*) into n from radar.videos where yt_video_id = 'vid00000001' and thumbnail_url like 'https://i.ytimg.com/%';
  if n <> 1 then raise exception 'FAIL ytimg thumbnail dropped'; end if;
  select count(*) into n from radar.videos;
  if n <> 2 then raise exception 'FAIL video rows=%', n; end if;
  select count(*) into n from radar.videos where yt_video_id = 'vid00000001' and views = 200 and title = 'one!';
  if n <> 1 then raise exception 'FAIL upsert update'; end if;
  select count(*) into n from radar.channels where id = cid and name = 'A renamed' and subs = 20 and last_scan_at is not null;
  if n <> 1 then raise exception 'FAIL channel refresh'; end if;
  -- 51개 묶음 거부
  begin perform radar.upsert_videos(cid, (select jsonb_agg(jsonb_build_object('yt_video_id', lpad(i::text, 11, '0'), 'title', 't',
      'published_at', now(), 'duration_s', 10)) from generate_series(1, 51) i));
    raise exception 'FAIL 51 videos accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- 쿼터 테이블: 전역은 접근 불가, 사용자 기록 직접 쓰기 불가
  begin perform 1 from radar.quota_global; raise exception 'FAIL quota_global readable';
  exception when insufficient_privilege then null; end;
  begin insert into radar.quota_usage (user_id, day) values (auth.uid(), current_date); raise exception 'FAIL quota_usage insert';
  exception when insufficient_privilege then null; end;
  begin perform radar.purge_stale(); raise exception 'FAIL purge callable';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) claim_scan: 성공 → 10분 안 재요청 too_soon
do $$
declare r text;
begin
  r := radar.claim_scan(10);
  if r <> 'ok' then raise exception 'FAIL claim_scan %', r; end if;
  r := radar.claim_scan(10);
  if r <> 'too_soon' then raise exception 'FAIL claim_scan interval %', r; end if;
  begin perform radar.claim_scan(0); raise exception 'FAIL units 0';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- 3) 사용자 일일 1,000 한도
reset role;
update radar.quota_usage set last_scan_at = now() - interval '11 minutes', units = 995
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
do $$
declare r text;
begin
  r := radar.claim_scan(10);
  if r <> 'user_daily_limit' then raise exception 'FAIL user daily %', r; end if;
  r := radar.claim_scan(5);
  if r <> 'ok' then raise exception 'FAIL user daily exact %', r; end if;
end $$;

-- 4) 전역 일일 8,000 한도(B는 첫 스캔이어도 거절)
reset role;
update radar.quota_global set units = 7995 where day = radar.quota_day();
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
do $$
declare r text;
begin
  r := radar.claim_scan(10);
  if r <> 'quota_exhausted' then raise exception 'FAIL global daily %', r; end if;
  r := radar.claim_lookup();
  if r <> 'ok' then raise exception 'FAIL lookup under global %', r; end if;
end $$;

-- 5) 전역 한도 도달: 스캔·채널 확인 모두 거절(전역 차단 표시 함수는 없다 — 직접 호출 DoS 방지)
reset role;
update radar.quota_global set units = 8000 where day = radar.quota_day();
set local role authenticated;
do $$ begin
  if to_regprocedure('radar.mark_quota_exhausted()') is not null then raise exception 'FAIL mark_quota_exhausted exists'; end if;
end $$;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
do $$
declare r text; n int;
begin
  r := radar.claim_scan(1);
  if r <> 'quota_exhausted' then raise exception 'FAIL after exhausted scan %', r; end if;
  r := radar.claim_lookup();
  if r <> 'quota_exhausted' then raise exception 'FAIL after exhausted lookup %', r; end if;
  select count(*) into n from radar.quota_usage;
  if n <> 1 then raise exception 'FAIL quota_usage own rows=%', n; end if;
end $$;

-- 6) 미승인: 모든 함수 거절, 읽기 0건
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
do $$
declare n int;
begin
  if radar.claim_scan(1) <> 'not_approved' then raise exception 'FAIL unapproved claim'; end if;
  if radar.claim_lookup() <> 'not_approved' then raise exception 'FAIL unapproved lookup'; end if;
  if radar.add_channel('@u', 'U', 'UC' || repeat('u', 22), 'UU' || repeat('u', 22), 1) <> 'not_approved' then
    raise exception 'FAIL unapproved add'; end if;
  select count(*) into n from radar.videos;
  if n <> 0 then raise exception 'FAIL unapproved videos=%', n; end if;
end $$;

-- 7) 채널 50개 상한 + 일일 확인 50회 상한
reset role;
delete from radar.quota_global;
insert into radar.channels (user_id, handle, yt_channel_id, uploads_playlist_id)
  select 'cccccccc-0000-0000-0000-000000000003', '@c' || i, 'UC' || lpad(i::text, 22, '0'), 'UU' || lpad(i::text, 22, '0')
  from generate_series(1, 49) i;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
do $$
declare r text;
begin
  r := radar.add_channel('@c50', 'C50', 'UC' || repeat('z', 22), 'UU' || repeat('z', 22), 1);
  if r <> 'ok' then raise exception 'FAIL 50th channel %', r; end if;
  r := radar.add_channel('@c51', 'C51', 'UC' || repeat('y', 22), 'UU' || repeat('y', 22), 1);
  if r <> 'channel_limit' then raise exception 'FAIL 51st channel %', r; end if;
  r := radar.claim_lookup();
  if r <> 'channel_limit' then raise exception 'FAIL lookup at channel limit %', r; end if;
end $$;
reset role;
update radar.quota_usage set channel_lookups = 50 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
do $$ begin
  if radar.claim_lookup() <> 'lookup_limit' then raise exception 'FAIL lookup limit'; end if;
end $$;

-- 8) 복합 FK: 남의 채널에 내 user_id로 영상을 붙일 수 없다(서버 권한으로도)
reset role;
do $$ begin
  insert into radar.videos (user_id, channel_id, yt_video_id, title, published_at, duration_s)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 900, 'xxxxxxxxxxx', 't', now(), 10);
  raise exception 'FAIL composite fk';
exception when foreign_key_violation then null; end $$;

-- 9) projects.source_video_id: 영상 삭제 시 null
do $$
declare vid bigint; n int;
begin
  select id into vid from radar.videos where yt_video_id = 'vid00000001';
  insert into studio.projects (id, user_id, type, source_video_id, source_url)
    values ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'video', vid, 'https://youtube.com/shorts/vid00000001');
  -- 남의 영상 id로는 연결 불가(복합 FK)
  begin
    insert into studio.projects (user_id, type, source_video_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'video', vid);
    raise exception 'FAIL other user source_video';
  exception when foreign_key_violation then null; end;
  delete from radar.videos where id = vid;
  select count(*) into n from studio.projects where id = '11111111-0000-0000-0000-00000000000a' and source_video_id is null and source_url is not null;
  if n <> 1 then raise exception 'FAIL source_video set null'; end if;
end $$;

-- 10) 30일 정리: 오래된 영상 삭제, 오래된 채널 name·subs 비움
do $$
declare n int;
begin
  update radar.videos set updated_at = now() - interval '31 days' where yt_video_id = 'vid00000002';
  update radar.channels set refreshed_at = now() - interval '31 days' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform radar.purge_stale();
  select count(*) into n from radar.videos where yt_video_id = 'vid00000002';
  if n <> 0 then raise exception 'FAIL stale video kept'; end if;
  select count(*) into n from radar.channels where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name is null and subs is null;
  if n <> 1 then raise exception 'FAIL stale channel meta kept'; end if;
  select count(*) into n from radar.channels where id = 900;
  if n <> 1 then raise exception 'FAIL fresh channel touched'; end if;
end $$;
rollback;
\echo PASS 07_radar
