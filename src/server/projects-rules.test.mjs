// projects-rules 단위 테스트 — node --test(타입 스트리핑)로 실행한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelFail, isUuid, licenseOf, parseNewProject, SOURCE_MAX_BYTES, startAnalyzeFail } from "./projects-rules.ts";

const base = { type: "video", lang: "ko", length: "keep", mimeType: "video/mp4", size: 1000 };

test("새 작업물: 허용·형식별 확장자", () => {
  assert.deepEqual(parseNewProject(base), { type: "video", lang: "ko", length: "keep", ext: "mp4" });
  assert.equal(parseNewProject({ ...base, mimeType: "video/quicktime" }).ext, "mov");
  assert.equal(parseNewProject({ ...base, mimeType: "video/webm", size: SOURCE_MAX_BYTES }).ext, "webm");
});

test("새 작업물: 거부 코드", () => {
  assert.equal(parseNewProject({ ...base, type: "x" }).code, "INVALID_REQUEST");
  assert.equal(parseNewProject({ ...base, length: "medium" }).code, "INVALID_REQUEST");
  assert.equal(parseNewProject({ ...base, mimeType: "video/x-msvideo" }).code, "UNSUPPORTED_FORMAT");
  for (const m of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(parseNewProject({ ...base, mimeType: m }).code, "UNSUPPORTED_FORMAT", m);
  }
  assert.equal(parseNewProject({ ...base, size: "1" }).code, "INVALID_REQUEST");
  assert.equal(parseNewProject({ ...base, size: 0 }).code, "INVALID_REQUEST");
  const big = parseNewProject({ ...base, size: SOURCE_MAX_BYTES + 1 });
  assert.equal(big.code, "FILE_TOO_LARGE");
  assert.equal(big.status, 413);
});

test("권리: 체크 + 유효 유형만 통과", () => {
  assert.equal(licenseOf({ rightsConfirmed: true, licenseType: "own" }), "own");
  assert.equal(licenseOf({ rightsConfirmed: false, licenseType: "own" }), null);
  assert.equal(licenseOf({ rightsConfirmed: "true", licenseType: "own" }), null);
  assert.equal(licenseOf({ rightsConfirmed: true, licenseType: "stolen" }), null);
  assert.equal(licenseOf({ rightsConfirmed: true }), null);
});

test("DB 결과 → 오류 코드", () => {
  assert.deepEqual(
    [["insufficient_credits", 402, "INSUFFICIENT_CREDITS"], ["rights_not_confirmed", 400, "RIGHTS_NOT_CONFIRMED"],
     ["concurrency_limit", 429, "CONCURRENCY_LIMIT"], ["source_missing", 409, "SOURCE_NOT_UPLOADED"],
     ["not_found", 404, "NOT_FOUND"], ["weird", 500, "UPSTREAM_ERROR"]].map(([r]) => {
      const f = startAnalyzeFail(r);
      return [r, f.status, f.code];
    }),
    [["insufficient_credits", 402, "INSUFFICIENT_CREDITS"], ["rights_not_confirmed", 400, "RIGHTS_NOT_CONFIRMED"],
     ["concurrency_limit", 429, "CONCURRENCY_LIMIT"], ["source_missing", 409, "SOURCE_NOT_UPLOADED"],
     ["not_found", 404, "NOT_FOUND"], ["weird", 500, "UPSTREAM_ERROR"]],
  );
  assert.equal(startAnalyzeFail("already_running", "j1").jobId, "j1");
  assert.equal(cancelFail("too_late").code, "CANCEL_TOO_LATE");
});

test("UUID 검사", () => {
  assert.ok(isUuid("11111111-0000-0000-0000-00000000000a"));
  assert.ok(!isUuid("1; drop"));
  assert.ok(!isUuid(1));
});
