---
paths:
  - "src/**"
  - "public/**"
---
# 웹 영역 규칙 (src/** 작업 때만 로드)
- 먼저 `~/.claude/skills/stack-nextjs/SKILL.md`를 읽는다.
- 화면은 `design/tokens.css`(유일한 정답, 앱은 `src/app/globals.css`가 import)를 따른다. 근거는 `design/prototypes/<화면>.dc.html` + `docs/PLAN.md` 4·11장 해당 절(통독 금지).
- 상태(빈·로딩·오류·성공)를 spec대로 모두 구현하고, `shot <URL>`로 3구간(~767 / 768~1199 / 1200~)을 확인한다.
- 서버 전용 코드는 `src/server/**`에만. 브라우저에서 LLM·결제·service_role을 직접 부르지 않는다.
