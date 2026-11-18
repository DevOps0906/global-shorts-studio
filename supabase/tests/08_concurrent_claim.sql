-- 테스트 8 세션 스크립트(run.sh가 두 세션으로 동시 실행): 같은 사용자의 claim_scan 동시 호출은 1건만 ok.
-- psql -v waiter=<1|0>. waiter=1(세션1): 잠금을 쥔 채, 다른 세션이 advisory 잠금 대기 중임을 확인한 뒤에만 커밋한다.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-0000-0000-00000000000f', true);
select 'RESULT ' || radar.claim_scan(5);
\if :waiter
reset role;
do $$
declare t0 timestamptz := clock_timestamp();
begin
  loop
    perform pg_stat_clear_snapshot();
    exit when exists (select 1 from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory');
    if clock_timestamp() - t0 > interval '20 seconds' then raise exception 'FAIL no waiting session seen'; end if;
    perform pg_sleep(0.1);
  end loop;
end $$;
select 'WAITER_SEEN';
\endif
commit;
