"""1·2·4단계 미디어 처리(ffprobe·FFmpeg·PySceneDetect·faster-whisper).

업로드 Content-Type·확장자는 믿지 않는다. 형식·길이는 ffprobe가 읽은 실제 내용으로만 판정한다.
- 모든 ffmpeg/ffprobe 호출: `-protocol_whitelist file,pipe`(원격·특수 프로토콜 차단).
  ffprobe는 `-format_whitelist mov,matroska`, 이후 호출은 판정된 demuxer를 `-f`로 고정한다.
- OpenCV(PySceneDetect)도 OPENCV_FFMPEG_CAPTURE_OPTIONS로 file 프로토콜만.
- 무거운 분석(장면·받아쓰기)은 별도 프로세스에서 벽시계 타임아웃으로 돌린다(넘으면 프로세스를 죽인다).
외부 프로세스는 셸 없이 인자 목록으로 실행한다.
"""

from __future__ import annotations

import hashlib
import json
import multiprocessing
import os
import re
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import errors
from .errors import StepError

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "protocol_whitelist;file"

MAX_DURATION_SECONDS = 180.0  # PLAN 13-7 업로드 제한 3분
DURATION_TOLERANCE = 0.5  # 컨테이너 반올림 오차
DECODE_LIMIT_SECONDS = "185"  # 판정 뒤에도 디코딩 길이를 한 번 더 자른다
MAX_DIMENSION = 4096
MAX_PIXELS = 4096 * 2304
MAX_FRAMES = 12  # PLAN 5-1 대표 프레임 최대 12장
MAX_PROXY_BYTES = 200 * 1024 * 1024
MAX_TRANSCRIPT_TEXT = 300
FFMPEG_THREADS = "2"
PROTOCOLS = ["-protocol_whitelist", "file,pipe"]

# ffprobe format_name → 허용 형식. webm은 matroska 계열이라 코덱으로 한 번 더 거른다.
_MP4_FAMILY = "mov,mp4,m4a,3gp,3g2,mj2"
_WEBM_FAMILY = "matroska,webm"
_WEBM_VIDEO_CODECS = {"vp8", "vp9", "av1"}
_DEMUXER = {"mp4": "mov", "webm": "matroska"}


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

    @property
    def demuxer(self) -> str:
        return _DEMUXER[self.container]


def _input(path: Path, demuxer: str) -> list[str]:
    return [*PROTOCOLS, "-f", demuxer, "-i", str(path)]


def run(cmd: list[str], timeout: float) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, timeout=timeout, check=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        raise StepError(errors.MEDIA_PROCESSING_FAILED, f"{cmd[0]} failed: {type(e).__name__}") from e


def ffprobe_cmd(path: Path) -> list[str]:
    return ["ffprobe", "-v", "error", "-protocol_whitelist", "file", "-format_whitelist", "mov,matroska",
            "-print_format", "json", "-show_format", "-show_streams", str(path)]


def ffprobe(path: Path) -> dict:
    try:
        out = subprocess.run(ffprobe_cmd(path), capture_output=True, text=True, timeout=60, check=True).stdout
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        # 영상으로 읽히지 않거나 허용 밖 형식(형식 위조 포함)
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
    """ffprobe JSON → 판정. 형식 3종 아님 UNSUPPORTED_FORMAT, 3분 초과 DURATION_TOO_LONG,
    해상도 초과 RESOLUTION_TOO_HIGH."""
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
    if not duration > 0:  # NaN 포함
        raise StepError(errors.UNSUPPORTED_FORMAT, "empty duration")
    if duration > max_seconds + DURATION_TOLERANCE:
        raise StepError(errors.DURATION_TOO_LONG, f"{duration:.1f}s")

    w, h = int(video.get("width") or 0), int(video.get("height") or 0)
    if w <= 0 or h <= 0:
        raise StepError(errors.UNSUPPORTED_FORMAT, "no frame size")
    if w > MAX_DIMENSION or h > MAX_DIMENSION or w * h > MAX_PIXELS:
        raise StepError(errors.RESOLUTION_TOO_HIGH, f"{w}x{h}")
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


# ---------- 벽시계 타임아웃(별도 프로세스) ----------

def run_with_timeout(fn: Callable[..., Any], args: tuple, timeout: float) -> Any:
    """fn(*args)를 spawn 프로세스에서 실행. timeout을 넘기면 프로세스를 종료하고 MEDIA_PROCESSING_FAILED."""
    ctx = multiprocessing.get_context("spawn")
    with ctx.Pool(1) as pool:
        res = pool.apply_async(fn, args)
        try:
            return res.get(timeout)
        except multiprocessing.TimeoutError as e:
            pool.terminate()
            raise StepError(errors.MEDIA_PROCESSING_FAILED, f"{getattr(fn, '__name__', 'task')} timeout") from e
        except StepError:
            raise
        except Exception as e:  # 자식 쪽 예외
            raise StepError(errors.MEDIA_PROCESSING_FAILED, f"{type(e).__name__}") from e


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


def cropdetect(path: Path, demuxer: str) -> tuple[int, int, int, int] | None:
    res = run(
        ["ffmpeg", "-hide_banner", "-nostats", "-threads", FFMPEG_THREADS, "-t", "60", *_input(path, demuxer),
         "-vf", "fps=2,cropdetect=24:2:0", "-an", "-f", "null", "-"],
        timeout=120,
    )
    return parse_cropdetect(res.stderr.decode("utf-8", "replace"))


def detect_scenes(path: Path, duration: float) -> list[tuple[float, float]]:
    """자식 프로세스에서 실행된다(run_with_timeout)."""
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "protocol_whitelist;file"
    from scenedetect import ContentDetector, detect  # 무거운 의존성은 쓸 때만 불러온다

    scenes = detect(str(path), ContentDetector(), end_time=float(DECODE_LIMIT_SECONDS))
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


def extract_frame(path: Path, demuxer: str, at: float, out: Path) -> Path:
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", FFMPEG_THREADS, "-ss", f"{at:.3f}",
         *_input(path, demuxer), "-frames:v", "1", "-vf", "scale='min(768,iw)':-2", "-q:v", "4", str(out)],
        timeout=60,
    )
    return out


def decode_audio(path: Path, demuxer: str, out: Path) -> Path:
    """16kHz 모노 float32 원시 파일. faster-whisper(PyAV)가 업로드 원본을 직접 열지 않게 한다."""
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", FFMPEG_THREADS, *_input(path, demuxer),
         "-t", DECODE_LIMIT_SECONDS, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", str(out)],
        timeout=120,
    )
    return out


def transcribe_pcm(pcm_path: str, model_name: str) -> list[dict]:
    """자식 프로세스에서 실행된다(run_with_timeout). faster-whisper(CPU, int8). [{start, end, text}]"""
    import numpy as np
    from faster_whisper import WhisperModel

    audio = np.fromfile(pcm_path, dtype=np.float32)
    if audio.size == 0:
        return []
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=2)
    segments, _info = model.transcribe(audio, vad_filter=True)
    return [
        {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()[:MAX_TRANSCRIPT_TEXT]}
        for s in segments if s.text.strip()
    ]


# ---------- 4단계: 컷 정리·프록시 ----------

def normalize_cuts(cuts: list[dict], duration: float, min_len: float = 0.2) -> tuple[list[dict], dict[int, int]]:
    """컷 경계 정리: 시간순 정렬, 0~duration으로 자르기, 겹침 제거, 너무 짧은 컷 버리기.
    반환: (정리된 컷, 원래 번호 → 새 번호). 버려진 컷은 매핑에 없다."""
    out: list[dict] = []
    mapping: dict[int, int] = {}
    prev_end = 0.0
    for idx, c in sorted(enumerate(cuts), key=lambda p: p[1]["start"]):
        start = max(0.0, c["start"], prev_end)
        end = min(duration, c["end"])
        if end - start < min_len:
            continue
        mapping[idx] = len(out)
        out.append({**c, "start": round(start, 3), "end": round(end, 3)})
        prev_end = end
    return out, mapping


def make_proxy(path: Path, demuxer: str, out: Path, max_bytes: int = MAX_PROXY_BYTES) -> Path:
    """미리보기용 저화질 프록시(짧은 변 540, H.264/AAC, faststart). 길이·스레드·크기 상한."""
    run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", FFMPEG_THREADS, *_input(path, demuxer),
         "-t", DECODE_LIMIT_SECONDS, "-map", "0:v:0", "-map", "0:a:0?",
         "-vf", "scale='if(gt(iw,ih),-2,min(540,iw))':'if(gt(iw,ih),min(540,ih),-2)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-fs", str(max_bytes), str(out)],
        timeout=600,
    )
    if out.stat().st_size >= max_bytes:
        raise StepError(errors.MEDIA_PROCESSING_FAILED, "proxy too large")
    return out
