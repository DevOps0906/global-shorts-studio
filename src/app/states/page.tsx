import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Kpi, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Banner, EmptyState, Message, SkeletonRow } from "@/components/ui/state-blocks";
import { Toast } from "@/components/ui/toast";
import { mockChips, mockKpis, mockProgress } from "@/mocks/states";

export const metadata: Metadata = { title: "화면 상태 · 글로벌쇼츠 스튜디오" };

type Tone = "default" | "err" | "warn";

// 시안 States: 카드 안 오류·경고 태그는 테두리형(투명 배경)
const tagLine: Record<Tone, string> = {
  default: "bg-card2",
  err: "border border-danger bg-transparent text-danger",
  warn: "border border-brand bg-transparent text-brand",
};

/** 시안 States의 .card: 태그 + 제목 + 위치 설명 + 점선 demo 영역 */
function StateCard({
  label,
  tag,
  tone = "default",
  title,
  where,
  children,
}: {
  label: string;
  tag: string;
  tone?: Tone;
  title: string;
  where: string;
  children: ReactNode;
}) {
  return (
    <Card aria-label={label} className="flex flex-col gap-2.5 rounded-2xl p-4 md:p-4">
      <Tag tone={tone} className={cn("self-start", tagLine[tone])}>
        {tag}
      </Tag>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="text-xs text-sub">{where}</p>
      {children}
    </Card>
  );
}

function Demo({ children, status }: { children: ReactNode; status?: boolean }) {
  return (
    <div
      {...(status ? { role: "status", "aria-label": "불러오는 중" } : {})}
      className="flex min-h-[9.375rem] flex-col justify-center gap-2.5 rounded-xl border border-dashed border-line bg-bg p-3.5"
    >
      {children}
    </div>
  );
}

const h2 = "mt-9 mb-3 text-h2 leading-[1.55] font-bold";
const small = "ml-1.5 text-caption font-medium text-sub";

/** 개발 전용 화면: 운영 빌드에서는 404, 개발에서는 로그인 없이 연다(proxy 예외) */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-[72.5rem] px-3.5 pb-[3.75rem] md:px-5 md:pb-20">
      <h1 className="mt-8 mb-1.5 text-h1 leading-[1.55] font-black">
        화면 <b className="text-brand">상태</b> 모음
      </h1>
      <p className="mb-2 text-base text-sub">
        기획 13-1 기준. 모든 화면이 로딩 · 빈 상태 · 오류 · 권한 없음을 가지며, 화면 고유 오류는 아래 대표 사례로 보여요.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {["모바일 ~767 · 본문 13 / h1 18 / h2 15", "태블릿 768~1199 · 14 / 22 / 17", "데스크탑 1200~ · 14 / 26 / 17"].map((t) => (
          <span key={t} className="rounded-full bg-card px-2.5 py-[0.1875rem] text-xs text-sub">
            {t}
          </span>
        ))}
      </div>

      <h2 className={h2}>
        공통 4상태<small className={small}>13-1 · 11-3</small>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StateCard
          label="로딩"
          tag="로딩"
          title="스켈레톤"
          where="300ms를 넘으면 카드·표 모양 그대로. 버튼 작업은 진행 막대(11-3)."
        >
          <Demo status>
            <SkeletonRow />
            <SkeletonRow />
          </Demo>
        </StateCard>

        <StateCard label="빈 상태" tag="빈 상태" title="한 줄 설명 + 버튼 1개" where="예: 새 영상 화면의 내 작업 없음.">
          <Demo>
            <EmptyState message="아직 작업이 없어요." action={<Btn variant="cta">첫 영상 만들기</Btn>} />
          </Demo>
        </StateCard>

        <StateCard
          label="오류"
          tag="오류"
          tone="err"
          title="무엇이 안 됐는지 + 다시 시도 + 오류 코드"
          where="입력값은 지우지 않는다. 코드는 13-4 기준."
        >
          <Demo>
            <Message title="소재를 불러오지 못했어요" code="UPSTREAM_ERROR">
              잠시 후 다시 시도해 주세요. 다른 영역은 정상이에요.
            </Message>
            <Btn className="self-start">다시 시도</Btn>
          </Demo>
        </StateCard>

        <StateCard
          label="권한 없음"
          tag="권한 없음"
          tone="warn"
          title="메뉴 숨김 + 마이페이지로 이동 + 토스트"
          where="주소로 직접 들어오면 마이페이지로 보내며 안내해요."
        >
          <Demo>
            <Toast>이 화면은 볼 수 없어요. 마이페이지로 이동했어요.</Toast>
          </Demo>
        </StateCard>
      </div>

      <h2 className={h2}>
        화면별 대표 오류<small className={small}>13-1 표</small>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StateCard
          label="편집 자동 저장 실패"
          tag="편집 /studio/:id"
          tone="err"
          title="자동 저장 실패 배너"
          where="상단 배너 + 브라우저에 임시 보관. 편집은 계속할 수 있어요."
        >
          <Demo>
            <Banner action={<Btn>다시 저장</Btn>}>저장하지 못했어요. 이 브라우저에 임시 보관 중이에요.</Banner>
          </Demo>
        </StateCard>

        <StateCard label="버전 충돌" tag="편집 /studio/:id" tone="err" title="VERSION_CONFLICT" where="다른 탭에서 수정했을 때.">
          <Demo>
            <Message tone="warn" title="다른 탭에서 먼저 수정했어요" code="VERSION_CONFLICT">
              최신 내용을 불러오면 지금 탭의 변경이 사라질 수 있어요.
            </Message>
            <div className="flex flex-wrap gap-2">
              <Btn variant="cta">최신 내용 불러오기</Btn>
              <Btn>내 변경 유지</Btn>
            </div>
          </Demo>
        </StateCard>

        <StateCard
          label="업로드 오류"
          tag="설정 /studio/new"
          tone="err"
          title="업로드 오류 (형식 · 3분 · 500MB)"
          where="권리 미확인 시 분석 버튼 비활성. 선택한 길이·언어·댓글은 그대로 둬요."
        >
          <Demo>
            <div className="rounded-[0.875rem] border-[0.09375rem] border-dashed border-danger bg-panel px-3 py-[1.125rem] text-center">
              <b className="block text-sm">영상을 끌어다 놓거나 눌러서 고르기</b>
              <span className="text-caption text-sub">MP4 · MOV · WebM · 최대 3분 · 최대 500MB</span>
            </div>
            <Message title="파일이 너무 커요 (612MB)" code="FILE_TOO_LARGE">
              500MB 이하, 3분 이하 영상으로 다시 골라 주세요.
            </Message>
            <textarea
              aria-label="참고 댓글(유지됨)"
              defaultValue="This is so me at 3am"
              className="box-border min-h-14 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-text"
            />
            <Btn variant="cta" disabled className="self-start">
              분석 시작 (권리 확인 필요)
            </Btn>
          </Demo>
        </StateCard>

        <StateCard label="쿼터 소진" tag="레이더" tone="err" title="유튜브 쿼터 소진" where="다음 초기화 시각을 보여 줘요.">
          <Demo>
            <Message tone="warn" title="오늘 스캔 한도를 모두 썼어요" code="YT_QUOTA_EXCEEDED">
              다음 초기화 · 오후 4:00 (한국 시간). 저장된 결과는 계속 볼 수 있어요.
            </Message>
            <Btn disabled className="self-start">
              스캔 (초기화 후 가능)
            </Btn>
          </Demo>
        </StateCard>

        <StateCard label="크레딧 부족" tag="크레딧" tone="err" title="크레딧 부족" where="비용을 쓰는 작업 직전에 안내. 충전은 마이페이지.">
          <Demo>
            {[
              ["필요 크레딧", "1"],
              ["보유 크레딧", "0"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2.5 text-caption text-sub">
                <span>{k}</span>
                <b className="text-danger">{v}</b>
              </div>
            ))}
            <Message title="크레딧이 부족해요" code="INSUFFICIENT_CREDITS">
              충전하면 같은 설정으로 바로 이어갈 수 있어요.
            </Message>
            <div className="flex flex-wrap gap-2">
              <Btn variant="cta">크레딧 충전</Btn>
              <Btn>닫기</Btn>
            </div>
          </Demo>
        </StateCard>
      </div>
      <p className="mt-2 text-caption text-sub">오류 코드 이름은 시안용 예시이며 확정 목록은 기획 13-4를 따라요.</p>

      <h2 className={h2}>
        공통 부품 확인<small className={small}>시안 States 밖 · 진행 막대 / 잠금 / KPI / 칩 / 성공</small>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StateCard label="진행 막대" tag="진행" title="줄무늬 진행 막대 + 버튼 잠금" where="진행 중에는 같은 작업 버튼을 잠가요(aria-busy).">
          <Demo>
            <div className="flex justify-between text-caption text-sub">
              <span>{mockProgress.label}</span>
              <b className="text-text">{mockProgress.pct}%</b>
              <span>{mockProgress.eta}</span>
            </div>
            <Progress value={mockProgress.pct} label={mockProgress.label} />
            <Btn variant="cta" loading className="self-start">
              분석 중…
            </Btn>
          </Demo>
        </StateCard>
        <StateCard label="KPI·칩·성공" tag="부품" title="KPI 타일 · 칩 · 성공 메시지" where="선택한 칩은 브랜드 테두리.">
          <Demo>
            <div className="grid grid-cols-2 gap-3">
              {mockKpis.slice(0, 2).map((k) => (
                <Kpi key={k.label} {...k} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {mockChips.map((c, i) => (
                <Chip key={c} selected={i === 0}>
                  {c}
                </Chip>
              ))}
            </div>
            <Message tone="ok" title="저장했어요">
              변경 내용이 반영됐어요.
            </Message>
          </Demo>
        </StateCard>
      </div>
    </main>
  );
}
