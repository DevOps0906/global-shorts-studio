-- 승인제 DB 반영(task-019): 미승인(승인 취소 포함) 사용자는 profiles 본인 행 읽기 외 전부 차단.
-- Storage 버킷 정책·service_role(워커·서버) 경로는 RLS를 건너뛴다 -> 앱 수준 게이트(getSession/requireSession, 큐 투입 전 승인 확인)가 맡는다.

-- 본인 승인 여부. 인자 없음(auth.uid() 고정)이라 남의 승인 상태를 물을 수 없다.
create function studio.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from studio.profiles p where p.user_id = (select auth.uid()) and p.approved_at is not null);
$$;
comment on function studio.is_approved() is '현재 사용자 승인 여부(profiles.approved_at not null).';
revoke execute on function studio.is_approved() from public, anon;
grant execute on function studio.is_approved() to authenticated, service_role;

-- 운영자·강사 판정도 승인된 경우만 참. 뷰 instructor_job_queue는 이 함수에 기대므로 함께 막힌다.
create or replace function studio.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from studio.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'operator' and p.approved_at is not null
  );
$$;
create or replace function studio.is_instructor_of(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from studio.cohort_members i
    join studio.cohort_members s on s.cohort_id = i.cohort_id and s.role = 'student'
    join studio.profiles p on p.user_id = i.user_id and p.approved_at is not null
    where i.user_id = (select auth.uid()) and i.role = 'instructor' and s.user_id = uid
  );
$$;

-- RESTRICTIVE: 기존 허용 정책과 AND로 묶인다. RLS가 켜진 studio·radar 테이블 중 profiles만 제외.
-- 새 테이블을 추가하면 같은 정책을 반드시 붙인다(supabase/tests/06_approval_gate.sql 카탈로그 검사가 누락을 잡는다).
create policy approved_only on radar.channels as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.cohort_members as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.projects as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.drafts as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.jobs as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.job_steps as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.user_settings as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.linked_accounts as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.credit_ledger as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.homework_progress as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.support_tickets as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.policy_flags as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
create policy approved_only on studio.admin_audit_log as restrictive for all to authenticated
  using ((select studio.is_approved())) with check ((select studio.is_approved()));
