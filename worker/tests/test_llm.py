"""3단계 LLM: refusal 우선 확인·스키마 위반 1회 재생성·fallback 요청 형태·5-3 스키마 검증."""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from conftest import valid_output

from app import errors, llm
from app.errors import StepError


def _resp(text: str | None = None, stop: str = "end_turn") -> SimpleNamespace:
    content = [] if text is None else [SimpleNamespace(type="text", text=text)]
    return SimpleNamespace(stop_reason=stop, content=content)


class FakeMessages:
    def __init__(self, responses: list[Any]) -> None:
        self.responses = list(responses)
        self.calls: list[dict] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class FakeClient:
    def __init__(self, responses: list[Any]) -> None:
        self.beta = SimpleNamespace(messages=FakeMessages(responses))
        self.messages = FakeMessages(list(responses))


def _gen(client: FakeClient, fallback: bool = True, duration: float = 30.0) -> llm.AnalysisOutput:
    return llm.generate(
        client, model="claude-sonnet-5-5", max_tokens=16000, effort="medium", fallback=fallback,
        duration=duration, build_content=lambda note: [{"type": "text", "text": f"note={note}"}],
    )


GOOD = json.dumps(valid_output(), ensure_ascii=False)


def test_valid_output_first_try_uses_fallback_beta_and_schema() -> None:
    c = FakeClient([_resp(GOOD)])
    out = _gen(c)
    assert len(out.titles) == 3
    call = c.beta.messages.calls[0]
    assert call["betas"] == ["server-side-fallback-2026-07-01"] and call["fallbacks"] == "default"
    assert call["model"] == "claude-sonnet-5-5"
    assert call["output_config"]["format"] == {"type": "json_schema", "schema": llm.OUTPUT_SCHEMA}
    assert c.messages.calls == []


def test_fallback_disabled_uses_plain_messages() -> None:
    c = FakeClient([_resp(GOOD)])
    _gen(c, fallback=False)
    assert c.beta.messages.calls == [] and "fallbacks" not in c.messages.calls[0]


def test_refusal_is_checked_before_content_and_not_retried() -> None:
    c = FakeClient([_resp(None, stop="refusal"), _resp(GOOD)])
    with pytest.raises(StepError) as e:
        _gen(c)
    assert e.value.code == errors.LLM_REFUSED and len(c.beta.messages.calls) == 1


def test_refusal_with_partial_text_is_still_refusal() -> None:
    c = FakeClient([_resp(GOOD, stop="refusal")])
    with pytest.raises(StepError) as e:
        _gen(c)
    assert e.value.code == errors.LLM_REFUSED


def test_invalid_then_valid_regenerates_once_with_note() -> None:
    bad = valid_output()
    bad["titles"][1]["hook"] = "contrast"  # 훅 중복
    c = FakeClient([_resp(json.dumps(bad)), _resp(GOOD)])
    out = _gen(c)
    assert len(out.scripts) == 3 and len(c.beta.messages.calls) == 2
    second = c.beta.messages.calls[1]["messages"][0]["content"][0]["text"]
    assert "note=None" not in second


@pytest.mark.parametrize("first", [_resp("{not json"), _resp(GOOD, stop="max_tokens"), _resp(None)])
def test_invalid_twice_is_schema_invalid(first: SimpleNamespace) -> None:
    c = FakeClient([first, _resp('{"titles": []}')])
    with pytest.raises(StepError) as e:
        _gen(c)
    assert e.value.code == errors.LLM_SCHEMA_INVALID and len(c.beta.messages.calls) == 2


def test_api_error_is_upstream() -> None:
    err = anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.invalid/v1/messages"))
    c = FakeClient([err])
    with pytest.raises(StepError) as e:
        _gen(c)
    assert e.value.code == errors.LLM_UPSTREAM


def _mutate(fn) -> dict:
    d = valid_output()
    fn(d)
    return d


@pytest.mark.parametrize(
    "data",
    [
        _mutate(lambda d: d["titles"].pop()),
        _mutate(lambda d: d["scripts"].pop()),
        _mutate(lambda d: d["scripts"][0]["cuts"][0].update(end=99.0)),
        _mutate(lambda d: d["scripts"][0]["cuts"][0].update(start=5.0, end=4.0)),
        _mutate(lambda d: d["scripts"][0]["cuts"][0].update(zoom=5.0)),
        _mutate(lambda d: d["scripts"][0].update(cuts=[])),
        _mutate(lambda d: d["mosaic"][0].update(box=[0.1, 0.2, 1.5, 0.1])),
        _mutate(lambda d: d["comments"][0].update(cut=9)),
        _mutate(lambda d: d.update(extra=1)),
        _mutate(lambda d: d["meta"].pop("hashtags")),
        _mutate(lambda d: d["sfx"][0].update(type="Pop!")),
        _mutate(lambda d: d["sfx"][0].update(type="a" * 33)),
        _mutate(lambda d: d["meta"].update(hashtags=["#t"] * 16)),
        _mutate(lambda d: d["meta"].update(hashtags=["#" + "가" * 50])),
        _mutate(lambda d: d["titles"][0].update(line1="가" * 41)),
        _mutate(lambda d: d["scripts"][0]["cuts"][0].update(caption="가" * 81)),
        _mutate(lambda d: d["meta"].update(description="가" * 1001)),
        _mutate(lambda d: d["scripts"][0]["cuts"][0].update(zoom=float("nan"))),
        _mutate(lambda d: d["sfx"][0].update(at=float("inf"))),
        _mutate(lambda d: d["comments"][0].update(text="")),
    ],
)
def test_validate_output_rejects_rule_violations(data: dict) -> None:
    with pytest.raises(ValueError):
        llm.validate_output(data, 30.0)


def test_edit_state_keeps_plan_5_3_keys() -> None:
    state = llm.to_edit_state(llm.validate_output(valid_output(), 30.0))
    assert set(state) == {"titles", "scripts", "sfx", "mosaic", "comments", "meta"}
    assert "from" in state["mosaic"][0] and "keepOriginal" in state["scripts"][0]["cuts"][0]


def _objects(schema: Any):
    if isinstance(schema, dict):
        if schema.get("type") == "object":
            yield schema
        for v in schema.values():
            yield from _objects(v)
    elif isinstance(schema, list):
        for v in schema:
            yield from _objects(v)


def test_output_schema_is_structured_output_compatible() -> None:
    objs = list(_objects(llm.OUTPUT_SCHEMA))
    assert objs and all(o["additionalProperties"] is False and set(o["required"]) == set(o["properties"])
                        for o in objs)
    text = json.dumps(llm.OUTPUT_SCHEMA)
    for kw in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "multipleOf"):
        assert f'"{kw}"' not in text


def test_user_content_has_frames_and_context(tmp_path) -> None:
    f = tmp_path / "f.jpg"
    f.write_bytes(b"\xff\xd8x")
    content = llm.build_user_content(
        frames=[(1.0, f)], transcript=[{"start": 0, "end": 1, "text": "hi"}], project_type="video",
        lang="ja", length_preset="short", duration=30.0, scenes=[(0.0, 30.0)], crop=None, vertical=True,
        retry_note="x",
    )
    assert [c["type"] for c in content] == ["text", "image", "text"]
    assert content[1]["source"]["media_type"] == "image/jpeg"
    assert "일본어" in content[-1]["text"] and "규칙을 어겼다" in content[-1]["text"]


def test_comment_index_refers_to_first_script() -> None:
    d = valid_output()
    d["scripts"][1]["cuts"] = d["scripts"][1]["cuts"] * 3  # 다른 안이 더 길어도 기준은 scripts[0]
    d["comments"][0]["cut"] = 2
    with pytest.raises(ValueError):
        llm.validate_output(d, 30.0)
