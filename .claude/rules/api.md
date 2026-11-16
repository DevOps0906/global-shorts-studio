---
paths:
  - "worker/**"
---
# 워커 영역 규칙 (worker/** 작업 때만 로드)
- 먼저 `~/.claude/skills/stack-fastapi/SKILL.md`의 Python·pytest 규약을 따른다(HTTP API가 생길 때 FastAPI).
- LLM·외부 API 키는 이 서버에만. 모델·제공자는 설정값으로(하드코딩 금지).
- 응답 형식이 바뀌면 `docs/PLAN.md` 5-3 스키마와 웹 소비 타입을 같은 작업에서 맞춘다.
