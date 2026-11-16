-- 테스트 3 세션 스크립트(run.sh가 두 세션으로 동시 실행).
-- psql -v key=<고유키> -v waiter=<1|0>
-- waiter=1(세션1): 잠금을 쥔 채, 다른 세션이 advisory 잠금 대기 중임을 pg_stat_activity로 확인한 뒤에만 커밋한다.
begin;
select 'RESULT ' || studio.spend_credits('aaaaaaaa-0000-0000-0000-000000000001', 1, null, :'key', 1);
\if :waiter
do $$
declare t0 timestamptz := clock_timestamp();
begin
  loop
    perform pg_stat_clear_snapshot();  -- 트랜잭션 안에서는 통계가 캐시되므로 매번 비운다
    exit when exists (select 1 from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory');
    if clock_timestamp() - t0 > interval '20 seconds' then raise exception 'FAIL no waiting session seen'; end if;
    perform pg_sleep(0.1);
  end loop;
end $$;
select 'WAITER_SEEN';
\endif
commit;
