"""1·2·4단계 미디어 처리(ffprobe·FFmpeg·PySceneDetect·faster-whisper).

업로드 Content-Type·확장자는 믿지 않는다. 형식·길이는 ffprobe가 읽은 실제 내용으로만 판정한다.
외부 프로세스는 셸 없이 인자 목록으로 실행한다.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import errors
from .errors import StepError

MAX_DURATION_SECONDS = 180.0  # PLAN 13-7 업로드 제한 3분
DURATION_TOLERANCE = 0.5  # 컨테이너 반올림 오차
MAX_FRAMES = 12  # PLAN 5-1 대표 프레임 최대 12장

# ffprobe format_name → 허용 형식. webm은 matroska 계열이라 코덱으로 한 번 더 거른다.
_MP4_FAMILY = "mov,mp4,m4a,3gp,3g2,mj2"
_WEBM_FAMILY = "matroska,webm"
_WEBM_VIDEO_CODECS = {"vp8", "vp9", "av1"}


@dataclass(frozen=True)
class ProbeResult:
    container: str  # "mp4"(mp4·mov 공통 계열) | "webm"
    duration: float
    width: int
    height: int
    video_codec: str
    has_audio: bool

    @property
    def vertical(self) -> bool:
        return self.height > self.width


def run(cmd: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        raise StepError(errors.MEDIA_PROCESSING_FAILED, f"{cmd[0]} failed: {type(e).__name__}") from e


def ffprobe(path: Path) -> dict:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
            capture_output=True, text=True, timeout=60, check=True,
        ).stdout
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        # 영상으로 읽히지 않는 내용(형식 위조 포함)
        raise StepError(errors.UNSUPPORTED_FORMAT, "ffprobe could not read source") from e
    except (subprocess.TimeoutExpired, OSError) as e:
        raise StepError(errors.MEDIA_PROCESSING_FAILED, "ffprobe failed") from e


def _rotation(stream: dict) -> int:
    for sd in stream.get("side_data_list") or []:
        if "rotation" in sd:
            return int(float(sd["rotation"]))
    tag = (stream.get("tags") or {}).get("rotate")
    return int(tag) if tag and tag.lstrip("-").isdigit() else 0


def judge_probe(info: dict, max_seconds: float = MAX_DURATION_SECONDS) -> ProbeResult:
    """ffprobe JSON → 판정. 형식이 3종이 아니면 UNSUPPORTED_FORMAT, 3분 초과면 DURATION_TOO_LONG."""
    fmt = info.get("format") or {}
    name = fmt.get("format_name", "")
    streams = info.get("streams") or []
    video = next(
        (s for s in streams if s.get("codec_type") == "video"
         and not (s.get("disposition") or {}).get("attached_pic")),
        None,
    )
    if video is None:
        raise StepError(errors.UNSUPPORTED_FORMAT, "no video stream")
    codec = video.get("codec_name", "")
    if name == _MP4_FAMILY:
        container = "mp4"
    elif name == _WEBM_FAMILY and codec in _WEBM_VIDEO_CODECS:
        container = "webm"
    else:
        raise StepError(errors.UNSUPPORTED_FORMAT, f"container {name!r}")

    try:
        duration = float(fmt.get("duration") or video.get("duration"))
    except (TypeError, ValueError) as e:
        raise StepError(errors.UNSUPPORTED_FORMAT, "unknown duration") from e
    if duration <= 0:
        raise StepError(errors.UNSUPPORTED_FORMAT, "empty duration")
    if duration > max_seconds + DURATION_TOLERANCE:
        raise StepError(errors.DURATION_TOO_LONG, f"{duration:.1f}s")

    w, h = int(video.get("width") or 0), int(video.get("height") or 0)
    if w <= 0 or h <= 0:
        raise StepError(errors.UNSUPPORTED_FORMAT, "no frame size")
    if abs(_rotation(video)) % 180 == 90:
        w, h = h, w
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    return ProbeResult(container, duration, w, h, codec, has_audio)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------- 2단계: 장면·여백·받아쓰기 ----------

_CROP_RE = re.compile(r"crop=(\d+):(\d+):(\d+):(\d+)")


def parse_cropdetect(stderr: str) -> tuple[int, int, int, int] | None:
    """cropdetect 로그의 마지막 crop=W:H:X:Y. 없으면 None."""
    found = _CROP_RE.findall(stderr)
    if not found:
        return None
    w, h, x, y = (int(v) for v in found[-1])
    return (w, h, x, y)


def crop_box(crop: tuple[int, int, int, int] | None, width: int, height: int) -> list[float] | None:
    """검은 여백·기존 틀 감지 결과를 [x, y, w, h] 비율(0~1)로. 여백이 거의 없으면 None."""
    if crop is None:
        return None
    w, h, x, y = crop
    if w >= width * 0.98 and h >= height * 0.98:
        return None
    return [round(x / width, 4), round(y / height, 4), round(w / width, 4), round(h / height, 4)]


def cropdetect(path: Path) -> tuple[int, int, int, int] | None:
    res = run(
        ["ffmpeg", "-hide_banner", "-nostats", "-t", "60", "-i", str(path),
         "-vf", "fps=2,cropdetect=24:2:0", "-an", "-f", "null", "-"],
        timeout=120,
    )
    return parse_cropdetect(res.stderr)


def detect_scenes(path: Path, duration: float) -> list[tuple[float, float]]:
    from scenedetect import ContentDetector, detect  # 무거운 의존성은 쓸 때만 불러온다

    scenes = detect(str(path), ContentDetector())
    out = [(round(a.get_seconds(), 3), round(b.get_seconds(), 3)) for a, b in scenes]
    return out or [(0.0, round(duration, 3))]


def pick_frame_times(scenes: list[tuple[float, float]], max_n: int = MAX_FRAMES) -> list[float]:
    """장면별 중앙 시각. 장면이 max_n보다 많으면 고르게 골라 max_n개."""
    if not scenes:
        return []
    if len(scenes) > max_n:
        step = len(scenes) / max_n
        scenes = [scenes[int(i * step)] for i in range(max_n)]
    return [round((a + b) / 2, 3) for a, b in scenes]


def extract_frame(path: Path, at: float, out: Path) -> Path:
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.3f}", "-i", str(path),
         "-frames:v", "1", "-vf", "scale='min(768,iw)':-2", "-q:v", "4", str(out)],
        timeout=60,
    )
    return out


_whisper_model = None


def transcribe(path: Path, model_name: str) -> list[dict]:
    """faster-whisper(CPU, int8). [{start, end, text}]"""
    global _whisper_model
    from faster_whisper import WhisperModel

    if _whisper_model is None:
        _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _info = _whisper_model.transcribe(str(path), vad_filter=True)
    return [
        {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
        for s in segments if s.text.strip()
    ]


# ---------- 4단계: 컷 정리·프록시 ----------

def normalize_cuts(cuts: list[dict], duration: float, min_len: float = 0.2) -> list[dict]:
    """컷 경계 정리: 시간순 정렬, 0~duration으로 자르기, 겹침 제거, 너무 짧은 컷 버리기."""
    out: list[dict] = []
    prev_end = 0.0
    for c in sorted(cuts, key=lambda c: c["start"]):
        start = max(0.0, c["start"], prev_end)
        end = min(duration, c["end"])
        if end - start < min_len:
            continue
        out.append({**c, "start": round(start, 3), "end": round(end, 3)})
        prev_end = end
    return out


def make_proxy(path: Path, out: Path) -> Path:
    """미리보기용 저화질 프록시(짧은 변 540, H.264/AAC, faststart)."""
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
         "-map", "0:v:0", "-map", "0:a:0?",
         "-vf", "scale='if(gt(iw,ih),-2,min(540,iw))':'if(gt(iw,ih),min(540,ih),-2)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out)],
        timeout=600,
    )
    return out
