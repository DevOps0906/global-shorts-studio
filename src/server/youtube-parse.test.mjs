// youtube-parse 단위 테스트 — node --test(타입 스트리핑)로 실행한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isShort, nextQuotaReset, parseChannelInput, parseIsoDuration, quotaDay } from "./youtube-parse.ts";

const ID = "UC" + "a".repeat(22);

test("채널 입력: 허용 형식", () => {
  const ok = [
    ["@handle", { kind: "handle", value: "@handle" }],
    ["  @my.handle_1-x  ", { kind: "handle", value: "@my.handle_1-x" }],
    ["@ねこチャンネル", { kind: "handle", value: "@ねこチャンネル" }],
    ["youtube.com/@handle", { kind: "handle", value: "@handle" }],
    ["https://www.youtube.com/@handle/shorts", { kind: "handle", value: "@handle" }],
    ["https://m.youtube.com/@handle?si=abc", { kind: "handle", value: "@handle" }],
    ["https://www.youtube.com/@%E3%81%AD%E3%81%93%E3%81%A1%E3%82%83%E3%82%93", { kind: "handle", value: "@ねこちゃん" }],
    [`https://youtube.com/channel/${ID}`, { kind: "id", value: ID }],
    [`www.youtube.com/channel/${ID}/videos`, { kind: "id", value: ID }],
  ];
  for (const [input, expected] of ok) assert.deepEqual(parseChannelInput(input), expected, input);
});

test("채널 입력: 거부 형식", () => {
  const bad = [
    "",
    "handle",
    "@ab",
    "@" + "a".repeat(31),
    "@bad handle",
    "고양이 쇼츠",
    "https://evil.com/@handle",
    "https://youtube.com.evil.com/@handle",
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/c/legacy",
    "https://www.youtube.com/user/legacy",
    "https://www.youtube.com/channel/UCshort",
    "javascript:alert(1)",
    "ftp://youtube.com/@handle",
    "https://www.youtube.com/@%E0%A4%A",
  ];
  for (const input of bad) assert.equal(parseChannelInput(input), null, input);
});

test("ISO 8601 기간 → 초", () => {
  assert.equal(parseIsoDuration("PT15S"), 15);
  assert.equal(parseIsoDuration("PT1M5S"), 65);
  assert.equal(parseIsoDuration("PT3M"), 180);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("P1DT1S"), 86401);
  assert.equal(parseIsoDuration("P0D"), 0);
  for (const bad of ["", "P", "PT", "15S", "PT1.5S", "PTXS"]) assert.equal(parseIsoDuration(bad), null, bad);
});

test("쇼츠 판정: 180초 이하", () => {
  assert.equal(isShort(180), true);
  assert.equal(isShort(181), false);
  assert.equal(isShort(0), false);
});

test("쿼터 기준일·초기화: LA 자정(서머타임 반영)", () => {
  // 2026-07-01 06:59Z = LA(PDT, -7) 6/30 23:59
  assert.equal(quotaDay(new Date("2026-07-01T06:59:00Z")), "2026-06-30");
  assert.equal(quotaDay(new Date("2026-07-01T07:00:00Z")), "2026-07-01");
  assert.equal(nextQuotaReset(new Date("2026-07-01T06:59:00Z")).toISOString(), "2026-07-01T07:00:00.000Z");
  // 겨울(PST, -8)
  assert.equal(quotaDay(new Date("2026-01-15T07:59:00Z")), "2026-01-14");
  assert.equal(nextQuotaReset(new Date("2026-01-15T12:00:00Z")).toISOString(), "2026-01-16T08:00:00.000Z");
  // 서머타임 시작 전날(3/7 PST) → 3/8 0시는 아직 PST
  assert.equal(nextQuotaReset(new Date("2026-03-07T20:00:00Z")).toISOString(), "2026-03-08T08:00:00.000Z");
  // 서머타임 시작 당일(3/8) → 3/9 0시는 PDT
  assert.equal(nextQuotaReset(new Date("2026-03-08T20:00:00Z")).toISOString(), "2026-03-09T07:00:00.000Z");
  // 서머타임 끝(11/1) → 11/2 0시는 PST
  assert.equal(nextQuotaReset(new Date("2026-11-01T20:00:00Z")).toISOString(), "2026-11-02T08:00:00.000Z");
});
