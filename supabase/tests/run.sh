#!/usr/bin/env bash
# 로컬 검증: postgres:17 컨테이너에 스텁 + 마이그레이션 + 테스트. 끝나면 컨테이너 삭제.
set -euo pipefail
cd "$(dirname "$0")"
C=gss-dbtest
cleanup() { docker rm -f "$C" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$C" -e POSTGRES_PASSWORD=pw postgres:17 >/dev/null
for _ in $(seq 1 60); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
P() { docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

P < _stub.sql
P < ../migrations/20261116184706_studio_schema.sql
P < ../migrations/20261116184740_fk_indexes.sql
P < ../migrations/20261118152240_approval_gate.sql
P < ../migrations/20261118160922_radar_videos.sql
P < ../migrations/20261118193428_studio_analyze.sql
echo "MIGRATION OK"
P < 01_rls_isolation.sql
P < 02_role_tamper.sql
P < 04_idempotency.sql
P < 05_review_fixes.sql
P < 06_approval_gate.sql
P < 07_radar.sql
P < 09_studio_analyze.sql

# 테스트 3: 잔액 1, 두 세션 동시 차감 -> 1건만 ok
P -c "insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
      select studio.grant_credits('aaaaaaaa-0000-0000-0000-000000000001', 1, 'gift', 'seed');" >/dev/null
OUT1=$(mktemp); OUT2=$(mktemp)
P -t -A -v key=sess1 -v waiter=1 < 03_concurrent_spend.sql > "$OUT1" &
PID1=$!
# 세션1이 잠금을 쥘 때까지 기다린 뒤 세션2 시작(세션2는 잠금에서 대기해야 한다)
for _ in $(seq 1 200); do grep -q "RESULT ok" "$OUT1" && break; sleep 0.1; done
grep -q "RESULT ok" "$OUT1" || { echo "FAIL session1 did not take lock"; exit 1; }
P -t -A -v key=sess2 -v waiter=0 < 03_concurrent_spend.sql > "$OUT2" &
PID2=$!
wait $PID1 $PID2
grep -q WAITER_SEEN "$OUT1" || { echo "FAIL waiter not observed"; exit 1; }
R=$(cat "$OUT1" "$OUT2" | grep RESULT | sort | tr '\n' ' ')
echo "concurrent: $R"
[ "$R" = "RESULT insufficient RESULT ok " ] || { echo "FAIL concurrent"; exit 1; }
BAL=$(P -t -A -c "select sum(delta) from studio.credit_ledger")
ROWS=$(P -t -A -c "select count(*) from studio.credit_ledger where reason='job'")
[ "$BAL" = "0" ] && [ "$ROWS" = "1" ] || { echo "FAIL ledger bal=$BAL job_rows=$ROWS"; exit 1; }
rm -f "$OUT1" "$OUT2"
echo "PASS 03_concurrent_spend (balance=$BAL, job rows=$ROWS)"

# 테스트 8: 같은 사용자 claim_scan 동시 2건 -> 1건만 ok(나머지 too_soon)
P -c "insert into auth.users (id) values ('ffffffff-0000-0000-0000-00000000000f');
      update studio.profiles set approved_at = now() where user_id = 'ffffffff-0000-0000-0000-00000000000f';" >/dev/null
OUT1=$(mktemp); OUT2=$(mktemp)
P -t -A -v waiter=1 < 08_concurrent_claim.sql > "$OUT1" &
PID1=$!
for _ in $(seq 1 200); do grep -q "RESULT ok" "$OUT1" && break; sleep 0.1; done
grep -q "RESULT ok" "$OUT1" || { echo "FAIL claim session1 did not take lock"; exit 1; }
P -t -A -v waiter=0 < 08_concurrent_claim.sql > "$OUT2" &
PID2=$!
wait $PID1 $PID2
grep -q WAITER_SEEN "$OUT1" || { echo "FAIL claim waiter not observed"; exit 1; }
R=$(cat "$OUT1" "$OUT2" | grep RESULT | sort | tr '
' ' ')
echo "concurrent claim: $R"
[ "$R" = "RESULT ok RESULT too_soon " ] || { echo "FAIL concurrent claim"; exit 1; }
U=$(P -t -A -c "select units from radar.quota_global")
[ "$U" = "5" ] || { echo "FAIL global units=$U"; exit 1; }
rm -f "$OUT1" "$OUT2"
echo "PASS 08_concurrent_claim (global units=$U)"
# 테스트 9 경쟁: 같은 작업물 start_analyze 동시 2건 -> 1건만 ok(나머지 already_running), 차감·잡·큐 각 1건
P -c "insert into auth.users (id) values ('abababab-0000-0000-0000-00000000000a');
      update studio.profiles set approved_at = now() where user_id = 'abababab-0000-0000-0000-00000000000a';
      select studio.grant_credits('abababab-0000-0000-0000-00000000000a', 5, 'gift', 't9c');
      insert into studio.projects (id, user_id, type, source_path) values ('abababab-1111-0000-0000-00000000000a',
        'abababab-0000-0000-0000-00000000000a', 'video', 'abababab-0000-0000-0000-00000000000a/abababab-1111-0000-0000-00000000000a/source.mp4');
      insert into storage.objects (bucket_id, name) values ('sources', 'abababab-0000-0000-0000-00000000000a/abababab-1111-0000-0000-00000000000a/source.mp4');" >/dev/null
OUT1=$(mktemp); OUT2=$(mktemp)
P -t -A -v waiter=1 < 09_concurrent_start.sql > "$OUT1" &
PID1=$!
for _ in $(seq 1 200); do grep -q "RESULT ok" "$OUT1" && break; sleep 0.1; done
grep -q "RESULT ok" "$OUT1" || { echo "FAIL start session1 did not take lock"; exit 1; }
P -t -A -v waiter=0 < 09_concurrent_start.sql > "$OUT2" &
PID2=$!
wait $PID1 $PID2
grep -q WAITER_SEEN "$OUT1" || { echo "FAIL start waiter not observed"; exit 1; }
R=$(cat "$OUT1" "$OUT2" | grep RESULT | sort | tr '
' ' ')
echo "concurrent start: $R"
[ "$R" = "RESULT already_running RESULT ok " ] || { echo "FAIL concurrent start"; exit 1; }
N=$(P -t -A -c "select (select count(*) from studio.jobs where project_id = 'abababab-1111-0000-0000-00000000000a')
  || ':' || (select sum(delta) from studio.credit_ledger where user_id = 'abababab-0000-0000-0000-00000000000a')
  || ':' || (select count(*) from pgmq.q_analyze)")
[ "$N" = "1:4:1" ] || { echo "FAIL concurrent start jobs:balance:msgs=$N"; exit 1; }
rm -f "$OUT1" "$OUT2"
echo "PASS 09_concurrent_start (jobs:balance:msgs=$N)"
echo "ALL PASS"
