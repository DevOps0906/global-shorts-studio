"""Supabase Storage REST(service_role). 원본 내려받기(크기 상한·SHA-256 동시 계산)·프록시 올리기.
키는 헤더로만 보내고 로그에 남기지 않는다."""

from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.parse import quote

import httpx

from . import errors
from .errors import StepError


class Storage:
    def __init__(self, base_url: str, service_key: str, bucket: str, max_bytes: int,
                 client: httpx.Client | None = None) -> None:
        self._base = base_url.rstrip("/") + "/storage/v1/object"
        self._headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}
        self._bucket = bucket
        self._max = max_bytes
        self._client = client or httpx.Client(timeout=httpx.Timeout(60.0, read=120.0))

    def _url(self, path: str) -> str:
        return f"{self._base}/{self._bucket}/{quote(path)}"

    def download(self, path: str, dest: Path) -> str:
        """원본을 dest로 받으며 SHA-256을 함께 계산. 없으면 SOURCE_MISSING, 상한 초과면 FILE_TOO_LARGE."""
        h = hashlib.sha256()
        size = 0
        try:
            with self._client.stream("GET", self._url(path), headers=self._headers) as r:
                if r.status_code in (400, 404):
                    raise StepError(errors.SOURCE_MISSING)
                r.raise_for_status()
                with dest.open("wb") as f:
                    for chunk in r.iter_bytes(1 << 20):
                        size += len(chunk)
                        if size > self._max:
                            raise StepError(errors.FILE_TOO_LARGE)
                        h.update(chunk)
                        f.write(chunk)
        except httpx.HTTPError as e:
            raise StepError(errors.MEDIA_PROCESSING_FAILED, f"storage download {type(e).__name__}") from e
        return h.hexdigest()

    def upload(self, path: str, src: Path, content_type: str = "video/mp4") -> None:
        headers = {**self._headers, "Content-Type": content_type, "x-upsert": "true"}
        try:
            with src.open("rb") as f:
                r = self._client.post(self._url(path), headers=headers, content=f.read())
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise StepError(errors.MEDIA_PROCESSING_FAILED, f"storage upload {type(e).__name__}") from e
