import { GOOGLE_PRIVACY_URL, YT_TERMS_URL } from "@/lib/radar-format";

/** YouTube API 데이터를 쓰는 화면 하단 고지(YouTube API 서비스 약관 III.A) */
export function YtNotice() {
  return (
    <p className="text-center text-xs text-sub">
      이 화면은 YouTube API 서비스를 사용해요 ·{" "}
      <a href={YT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center underline">
        YouTube 서비스 약관
      </a>{" "}
      ·{" "}
      <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center underline">
        Google 개인정보처리방침
      </a>
    </p>
  );
}
