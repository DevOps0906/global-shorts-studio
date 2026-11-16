#!/usr/bin/env bash
# 로컬 검증: postgres:17 컨테이너에 스텁 + 마이그레이션 + 테스트 4가지. 끝나면 컨테이너 삭제.
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
P < ../migrations/20261117000000_studio_schema.sql
echo "MIGRATION OK"
P < 01_rls_isolation.sql
P < 02_role_tamper.sql
P < 04_idempotency.sql
P < 05_review_fixes.sql

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
echo "ALL PASS"
