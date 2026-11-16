-- 성능 점검(unindexed_foreign_keys): 복합 FK를 덮는 인덱스
create index credit_ledger_job_user_idx on studio.credit_ledger (job_id, user_id);
create index drafts_project_user_idx on studio.drafts (project_id, user_id);
create index job_steps_job_user_idx on studio.job_steps (job_id, user_id);
create index jobs_project_user_idx on studio.jobs (project_id, user_id);
