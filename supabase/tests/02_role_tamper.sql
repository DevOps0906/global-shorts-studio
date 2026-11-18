-- 테스트 2: 자기 role 수정 거부.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t');
update studio.profiles set approved_at = now();   -- 승인된 회원 기준(task-019)

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

do $$
declare r text;
begin
  begin update studio.profiles set role = 'operator' where user_id = auth.uid(); raise exception 'FAIL role update allowed';
  exception when insufficient_privilege then null; end;
  begin update studio.profiles set plan = 'pro' where user_id = auth.uid(); raise exception 'FAIL plan update allowed';
  exception when insufficient_privilege then null; end;
  begin insert into studio.profiles (user_id, role) values (gen_random_uuid(), 'operator'); raise exception 'FAIL profile insert allowed';
  exception when insufficient_privilege then null; end;
  begin insert into studio.cohort_members (cohort_id, user_id, role) values (gen_random_uuid(), auth.uid(), 'instructor'); raise exception 'FAIL cohort insert allowed';
  exception when insufficient_privilege then null; end;
  if studio.is_operator() then raise exception 'FAIL became operator'; end if;
  if studio.is_instructor_of(auth.uid()) then raise exception 'FAIL became instructor'; end if;
  select role into r from studio.profiles where user_id = auth.uid();
  if r <> 'member' then raise exception 'FAIL role=%', r; end if;
end $$;

-- 판정은 profiles.role만 근거: user_metadata 류 클레임을 줘도 운영자가 되지 않는다.
select set_config('request.jwt.claims', '{"user_metadata":{"role":"operator"},"app_metadata":{"role":"operator"}}', true);
do $$ begin if studio.is_operator() then raise exception 'FAIL metadata honored'; end if; end $$;

-- service_role이 올리면 운영자가 된다(대조군, 승인 상태 유지)
reset role;
update studio.profiles set role = 'operator', approved_at = now() where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin if not studio.is_operator() then raise exception 'FAIL operator not recognized'; end if; end $$;
rollback;
\echo PASS 02_role_tamper
