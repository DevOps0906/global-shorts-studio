-- 워커 DB 테스트 전용: supabase/tests/_stub.sql의 pgmq(send만)를 read·archive까지 되는 스텁으로 바꾼다.
-- 실제 pgmq q_<queue> 테이블과 같은 컬럼(msg_id·read_ct·enqueued_at·vt·message), read는 for update skip locked.
drop function pgmq.send(text, jsonb, integer);
drop table pgmq.q_analyze;
create table pgmq.q_analyze (
  msg_id bigint generated always as identity primary key,
  read_ct int not null default 0,
  enqueued_at timestamptz not null default now(),
  vt timestamptz not null default now(),
  message jsonb not null
);
create table pgmq.a_analyze (
  msg_id bigint primary key, read_ct int, enqueued_at timestamptz, archived_at timestamptz not null default now(),
  vt timestamptz, message jsonb
);
create function pgmq.send(text, jsonb, integer default 0) returns setof bigint language sql as $$
  insert into pgmq.q_analyze (message, vt) values ($2, clock_timestamp() + make_interval(secs => $3)) returning msg_id
$$;
create function pgmq.read(text, integer, integer)
returns table (msg_id bigint, read_ct int, enqueued_at timestamptz, vt timestamptz, message jsonb) language sql as $$
  with c as (
    select q.msg_id from pgmq.q_analyze q where q.vt <= clock_timestamp() order by q.msg_id limit $3 for update skip locked
  )
  update pgmq.q_analyze q set vt = clock_timestamp() + make_interval(secs => $2), read_ct = q.read_ct + 1
  from c where q.msg_id = c.msg_id
  returning q.msg_id, q.read_ct, q.enqueued_at, q.vt, q.message
$$;
create function pgmq.archive(text, bigint) returns boolean language sql as $$
  with d as (delete from pgmq.q_analyze where msg_id = $2 returning *),
  i as (insert into pgmq.a_analyze (msg_id, read_ct, enqueued_at, vt, message)
        select msg_id, read_ct, enqueued_at, vt, message from d returning 1)
  select exists (select 1 from i)
$$;
