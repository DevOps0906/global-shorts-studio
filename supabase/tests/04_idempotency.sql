-- 테스트 4: 같은 키 2회 호출 시 1행. + 환불 규칙(차감 선행·초과·타인 작업 거부), 원장-작업 소유 FK.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t');
insert into studio.projects (id, user_id, type) values ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'video');
insert into studio.jobs (id, user_id, project_id, kind) values
  ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a', 'analyze');
do $$
declare r1 text; r2 text; n int; bal int;
  u uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; u2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  j uuid := '22222222-0000-0000-0000-00000000000a';
begin
  if studio.grant_credits(u, 5, 'gift', 'g1') <> 'ok' then raise exception 'FAIL grant'; end if;
  if studio.grant_credits(u, 5, 'gift', 'g1') <> 'duplicate' then raise exception 'FAIL grant dup'; end if;
  if studio.grant_credits(u2, 5, 'gift', 'g2') <> 'ok' then raise exception 'FAIL grant u2'; end if;

  -- 같은 키 2회 -> 1행
  r1 := studio.spend_credits(u, 1, j, j || ':analyze:1', 1);
  r2 := studio.spend_credits(u, 1, j, j || ':analyze:1', 1);
  select count(*) into n from studio.credit_ledger where idempotency_key = j || ':analyze:1';
  select sum(delta) into bal from studio.credit_ledger where user_id = u;
  if r1 <> 'ok' or r2 <> 'duplicate' or n <> 1 or bal <> 4 then raise exception 'FAIL spend r1=% r2=% rows=% bal=%', r1, r2, n, bal; end if;

  -- 환불 규칙
  if studio.refund_credits(u, 1, j, 2, j || ':refund:x') <> 'no_charge' then raise exception 'FAIL refund without charge'; end if;
  if studio.refund_credits(u2, 1, j, 1, j || ':refund:other') <> 'no_charge' then raise exception 'FAIL refund other user job'; end if;
  if studio.refund_credits(u, 2, j, 1, j || ':refund:over') <> 'over_refund' then raise exception 'FAIL over refund'; end if;
  if studio.refund_credits(u, 1, j, 1, j || ':refund:1') <> 'ok' then raise exception 'FAIL refund'; end if;
  if studio.refund_credits(u, 1, j, 1, j || ':refund:1b') <> 'duplicate' then raise exception 'FAIL refund dup(other key)'; end if;
  if studio.refund_credits(u, 1, j, 1, j || ':refund:1') <> 'duplicate' then raise exception 'FAIL refund dup(same key)'; end if;
  -- 재시도(attempt 2): 차감 후에만 환불 가능
  if studio.spend_credits(u, 1, j, j || ':analyze:2', 2) <> 'ok' then raise exception 'FAIL spend attempt2'; end if;
  if studio.refund_credits(u, 1, j, 2, j || ':refund:2') <> 'ok' then raise exception 'FAIL refund attempt2'; end if;
  select count(*) into n from studio.credit_ledger where reason = 'refund';
  select sum(delta) into bal from studio.credit_ledger where user_id = u;
  if n <> 2 or bal <> 5 then raise exception 'FAIL refund rows=% bal=%', n, bal; end if;

  -- 타인 작업(job)에 내 원장 기록 불가(복합 FK)
  begin perform studio.spend_credits(u2, 1, j, 'cross-owner', 1); raise exception 'FAIL cross-owner spend';
  exception when foreign_key_violation then null; end;

  -- 부호 check
  begin insert into studio.credit_ledger (user_id, delta, reason, idempotency_key) values (u, 3, 'job', 'bad1'); raise exception 'FAIL sign job+';
  exception when check_violation then null; end;
  begin insert into studio.credit_ledger (user_id, delta, reason, idempotency_key) values (u, -3, 'gift', 'bad2'); raise exception 'FAIL sign gift-';
  exception when check_violation then null; end;

  -- 작업이 지워져도 원장은 남고 job_id만 null (user_id 유지)
  delete from studio.jobs where id = j;
  select count(*) into n from studio.credit_ledger where user_id = u and job_id is null;
  select count(*) into bal from studio.credit_ledger where user_id = u;
  if n <> bal or bal <> 5 then raise exception 'FAIL ledger after job delete null=% total=%', n, bal; end if;
end $$;
rollback;
\echo PASS 04_idempotency
