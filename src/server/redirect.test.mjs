// safeNext 단위 테스트 — 새 의존성 없이 node --test(타입 스트리핑)로 실행한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./redirect.ts";

const origin = "https://studio.example.com";

const rejected = [
  ["프로토콜 상대 주소", "//evil.com"],
  ["백슬래시", "/\\evil.com"],
  ["탭 문자", "/\t/evil.com"],
  ["개행 문자", "/\n/evil.com"],
  ["퍼센트 인코딩 슬래시", "%2F%2Fevil.com"],
  ["절대 주소", "https://evil.com"],
  ["로그인 화면", "/login"],
  ["로그인 화면 + 쿼리", "/login?next=/radar"],
  ["인증 콜백", "/auth/callback"],
  ["점 경로로 숨긴 로그인", "/./login"],
  ["점 경로 정규화 뒤 //", "/a/..//evil.com"],
  ["인코딩된 점 경로 뒤 //", "/a/%2e%2e//evil.com"],
  ["현재 경로 점 뒤 //", "/.//evil.com"],
  ["빈 값", ""],
  ["null", null],
];

for (const [name, next] of rejected) {
  test(`거부: ${name}`, () => {
    assert.equal(safeNext(next, origin), "/");
  });
}

test("허용: 같은 출처 경로 + 쿼리", () => {
  assert.equal(safeNext("/radar?x=1", origin), "/radar?x=1");
});

test("허용: 루트", () => {
  assert.equal(safeNext("/", origin), "/");
});

test("허용: 같은 출처의 퍼센트 인코딩 경로는 경로로만 남는다", () => {
  assert.equal(safeNext("/%2F%2Fevil.com", origin), "/%2F%2Fevil.com");
});
