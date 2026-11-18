"""Storage REST: 원본 없음·크기 초과·해시·업로드(가짜 전송, 실제 Supabase 호출 없음)."""

from __future__ import annotations

import hashlib
from pathlib import Path

import httpx
import pytest

from app import errors
from app.errors import StepError
from app.storage import Storage


def _storage(handler, max_bytes: int = 1000) -> Storage:
    return Storage("https://proj.supabase.invalid", "svc-key", "sources", max_bytes,
                   client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_download_hashes_and_sends_service_headers(tmp_path: Path) -> None:
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"] = str(req.url), req.headers.get("authorization")
        return httpx.Response(200, content=b"video-bytes")

    sha = _storage(handler).download("u/p/source.mp4", tmp_path / "s")
    assert sha == hashlib.sha256(b"video-bytes").hexdigest()
    assert seen["url"].endswith("/storage/v1/object/sources/u/p/source.mp4")
    assert seen["auth"] == "Bearer svc-key"


def test_download_missing_is_source_missing(tmp_path: Path) -> None:
    with pytest.raises(StepError) as e:
        _storage(lambda r: httpx.Response(404)).download("u/p/source.mp4", tmp_path / "s")
    assert e.value.code == errors.SOURCE_MISSING


def test_download_over_limit_is_too_large(tmp_path: Path) -> None:
    with pytest.raises(StepError) as e:
        _storage(lambda r: httpx.Response(200, content=b"x" * 2000)).download("a", tmp_path / "s")
    assert e.value.code == errors.FILE_TOO_LARGE


def test_download_server_error_is_media_failure(tmp_path: Path) -> None:
    with pytest.raises(StepError) as e:
        _storage(lambda r: httpx.Response(500)).download("a", tmp_path / "s")
    assert e.value.code == errors.MEDIA_PROCESSING_FAILED


def test_upload_upserts_proxy(tmp_path: Path) -> None:
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["method"], seen["upsert"], seen["ct"] = req.method, req.headers.get("x-upsert"), req.headers.get(
            "content-type")
        return httpx.Response(200, json={"Key": "x"})

    src = tmp_path / "proxy.mp4"
    src.write_bytes(b"p")
    _storage(handler).upload("u/p/proxy.mp4", src)
    assert seen == {"method": "POST", "upsert": "true", "ct": "video/mp4"}


def test_upload_streams_with_content_length(tmp_path: Path) -> None:
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["len"] = req.headers.get("content-length")
        seen["body"] = req.read()
        return httpx.Response(200)

    src = tmp_path / "proxy.mp4"
    src.write_bytes(b"z" * (3 << 20))
    _storage(handler).upload("u/p/proxy.mp4", src)
    assert seen["len"] == str(3 << 20) and len(seen["body"]) == 3 << 20


@pytest.mark.parametrize("code", [200, 404])
def test_delete_ok_or_missing(code: int) -> None:
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["method"] = req.method
        return httpx.Response(code)

    _storage(handler).delete("u/p/proxy.mp4")
    assert seen["method"] == "DELETE"
