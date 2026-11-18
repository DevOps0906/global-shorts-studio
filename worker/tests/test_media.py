"""1·2·4단계 순수 로직 + (ffmpeg가 있으면) 실제 ffprobe·FFmpeg 판정."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from app import errors, media
from app.errors import StepError


def _info(fmt: str = "mov,mp4,m4a,3gp,3g2,mj2", duration: str = "30.0", codec: str = "h264",
          w: int = 1080, h: int = 1920, audio: bool = True, **video_extra) -> dict:
    streams = [{"codec_type": "video", "codec_name": codec, "width": w, "height": h, **video_extra}]
    if audio:
        streams.append({"codec_type": "audio", "codec_name": "aac"})
    return {"format": {"format_name": fmt, "duration": duration}, "streams": streams}


def test_mp4_ok() -> None:
    r = media.judge_probe(_info())
    assert r.container == "mp4" and r.vertical and r.has_audio and r.duration == 30.0


def test_webm_ok_only_with_web_codecs() -> None:
    assert media.judge_probe(_info(fmt="matroska,webm", codec="vp9")).container == "webm"
    with pytest.raises(StepError) as e:  # mkv(h264)는 webm 확장자여도 거부
        media.judge_probe(_info(fmt="matroska,webm", codec="h264"))
    assert e.value.code == errors.UNSUPPORTED_FORMAT


@pytest.mark.parametrize("fmt", ["avi", "mp3", "gif", "image2", "flv", ""])
def test_other_containers_rejected(fmt: str) -> None:
    with pytest.raises(StepError) as e:
        media.judge_probe(_info(fmt=fmt))
    assert e.value.code == errors.UNSUPPORTED_FORMAT


def test_audio_only_or_cover_art_only_rejected() -> None:
    audio_only = {"format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "10"},
                  "streams": [{"codec_type": "audio"}]}
    cover = _info(codec="mjpeg", disposition={"attached_pic": 1})
    for info in (audio_only, cover):
        with pytest.raises(StepError) as e:
            media.judge_probe(info)
        assert e.value.code == errors.UNSUPPORTED_FORMAT


@pytest.mark.parametrize(("dur", "ok"), [("180.0", True), ("180.4", True), ("181", False), ("600", False)])
def test_duration_limit_three_minutes(dur: str, ok: bool) -> None:
    if ok:
        media.judge_probe(_info(duration=dur))
    else:
        with pytest.raises(StepError) as e:
            media.judge_probe(_info(duration=dur))
        assert e.value.code == errors.DURATION_TOO_LONG


@pytest.mark.parametrize("dur", [None, "N/A", "0"])
def test_missing_duration_rejected(dur) -> None:
    info = _info()
    info["format"]["duration"] = dur
    with pytest.raises(StepError) as e:
        media.judge_probe(info)
    assert e.value.code == errors.UNSUPPORTED_FORMAT


def test_rotation_swaps_orientation() -> None:
    r = media.judge_probe(_info(w=1920, h=1080, side_data_list=[{"rotation": -90}]))
    assert (r.width, r.height, r.vertical) == (1080, 1920, True)


def test_parse_cropdetect_takes_last() -> None:
    log = "[Parsed_cropdetect_1] x1:0 crop=1080:1600:0:160\n... crop=1080:1588:0:166\n"
    assert media.parse_cropdetect(log) == (1080, 1588, 0, 166)
    assert media.parse_cropdetect("nothing") is None


def test_crop_box_ratio_and_full_frame_none() -> None:
    assert media.crop_box((1080, 1600, 0, 160), 1080, 1920) == [0.0, 0.0833, 1.0, 0.8333]
    assert media.crop_box((1080, 1920, 0, 0), 1080, 1920) is None
    assert media.crop_box(None, 1080, 1920) is None


def test_pick_frame_times_max_twelve_evenly() -> None:
    assert media.pick_frame_times([(0, 2), (2, 6)]) == [1.0, 4.0]
    many = [(float(i), float(i + 1)) for i in range(40)]
    times = media.pick_frame_times(many)
    assert len(times) == 12 and times == sorted(times) and times[0] == 0.5
    assert media.pick_frame_times([]) == []


def test_normalize_cuts_with_index_mapping() -> None:
    cuts = [
        {"start": 5.0, "end": 9.0, "caption": "b"},
        {"start": -1.0, "end": 5.5, "caption": "a"},
        {"start": 9.0, "end": 9.1, "caption": "too short"},
        {"start": 28.0, "end": 40.0, "caption": "c"},
    ]
    out, mapping = media.normalize_cuts(cuts, 30.0)
    assert [(c["caption"], c["start"], c["end"]) for c in out] == [
        ("a", 0.0, 5.5), ("b", 5.5, 9.0), ("c", 28.0, 30.0)]
    assert mapping == {1: 0, 0: 1, 3: 2}


@pytest.mark.parametrize(("w", "h"), [(4097, 1000), (1000, 4097), (4096, 4096), (3000, 3200)])
def test_resolution_limit(w: int, h: int) -> None:
    with pytest.raises(StepError) as e:
        media.judge_probe(_info(w=w, h=h))
    assert e.value.code == errors.RESOLUTION_TOO_HIGH


def test_resolution_4k_ok() -> None:
    assert media.judge_probe(_info(w=3840, h=2160)).width == 3840


def test_nan_duration_rejected() -> None:
    with pytest.raises(StepError):
        media.judge_probe(_info(duration="nan"))


def test_every_ffmpeg_call_whitelists_protocols_and_fixes_demuxer(monkeypatch, tmp_path: Path) -> None:
    cmds: list[list[str]] = []

    def fake_run(cmd, **kw):
        cmds.append(cmd)
        if cmd[0] == "ffmpeg" and cmd[-1] not in ("-",):
            Path(cmd[-1]).write_bytes(b"x")
        return subprocess.CompletedProcess(cmd, 0, stdout=b"{}", stderr=b"")

    monkeypatch.setattr(media.subprocess, "run", fake_run)
    src = tmp_path / "source"
    media.cropdetect(src, "mov")
    media.extract_frame(src, "matroska", 1.0, tmp_path / "f.jpg")
    media.decode_audio(src, "mov", tmp_path / "a.f32")
    media.make_proxy(src, "mov", tmp_path / "p.mp4")
    for cmd in cmds:
        i = cmd.index("-i")
        assert cmd[i - 4:i] in (["-protocol_whitelist", "file,pipe", "-f", "mov"],
                                ["-protocol_whitelist", "file,pipe", "-f", "matroska"])
        assert "-threads" in cmd
    proxy = cmds[-1]
    assert proxy[proxy.index("-t") + 1] == "185" and "-fs" in proxy
    probe = media.ffprobe_cmd(src)
    assert probe[probe.index("-protocol_whitelist") + 1] == "file"
    assert probe[probe.index("-format_whitelist") + 1] == "mov,matroska"


def test_opencv_capture_is_file_only() -> None:
    import os

    assert os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] == "protocol_whitelist;file"


def test_proxy_over_limit_rejected(monkeypatch, tmp_path: Path) -> None:
    def fake_run(cmd, **kw):
        Path(cmd[-1]).write_bytes(b"x" * 100)
        return subprocess.CompletedProcess(cmd, 0, stdout=b"", stderr=b"")

    monkeypatch.setattr(media.subprocess, "run", fake_run)
    with pytest.raises(StepError) as e:
        media.make_proxy(tmp_path / "s", "mov", tmp_path / "p.mp4", max_bytes=100)
    assert e.value.code == errors.MEDIA_PROCESSING_FAILED


def test_run_with_timeout_kills_slow_work() -> None:
    import time

    t0 = time.monotonic()
    with pytest.raises(StepError) as e:
        media.run_with_timeout(time.sleep, (30,), timeout=1.0)
    assert e.value.code == errors.MEDIA_PROCESSING_FAILED and time.monotonic() - t0 < 15


def test_run_with_timeout_returns_and_wraps_child_errors() -> None:
    assert media.run_with_timeout(max, (3, 9), timeout=30) == 9
    with pytest.raises(StepError):
        media.run_with_timeout(int, ("x",), timeout=30)


def test_sha256_file(tmp_path: Path) -> None:
    p = tmp_path / "x"
    p.write_bytes(b"abc")
    assert media.sha256_file(p) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


# ---------- 실제 ffmpeg(설치돼 있을 때만) ----------

needs_ffmpeg = pytest.mark.skipif(not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="ffmpeg 없음")


def _make_video(out: Path, seconds: float, size: str = "360x640", pad: bool = False) -> Path:
    vf = ["-vf", "pad=iw:ih+160:0:80:black"] if pad else []
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=10:duration={seconds}",
         "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}",
         *vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)],
        check=True, capture_output=True,
    )
    return out


@needs_ffmpeg
def test_real_probe_ignores_extension_and_reads_content(tmp_path: Path) -> None:
    v = _make_video(tmp_path / "v.mp4", 2)
    renamed = tmp_path / "source"  # 확장자 없이도 내용으로 판정
    v.rename(renamed)
    r = media.judge_probe(media.ffprobe(renamed))
    assert r.container == "mp4" and r.vertical and r.has_audio and 1.5 < r.duration < 2.5


@needs_ffmpeg
def test_real_probe_rejects_non_video_bytes(tmp_path: Path) -> None:
    fake = tmp_path / "source"
    fake.write_bytes(b"<html>this is not a video</html>" * 50)
    with pytest.raises(StepError) as e:
        media.judge_probe(media.ffprobe(fake))
    assert e.value.code == errors.UNSUPPORTED_FORMAT


@needs_ffmpeg
def test_real_frame_crop_and_proxy(tmp_path: Path) -> None:
    v = _make_video(tmp_path / "v.mp4", 2, pad=True)
    frame = media.extract_frame(v, "mov", 1.0, tmp_path / "f.jpg")
    assert frame.stat().st_size > 0
    crop = media.cropdetect(v, "mov")
    assert crop is not None and crop[1] < 800  # 위아래 검은 띠 감지
    pcm = media.decode_audio(v, "mov", tmp_path / "a.f32")
    assert abs(pcm.stat().st_size - 2 * 16000 * 4) < 16000  # 약 2초 · 16kHz · float32(AAC 패딩 오차)
    proxy = media.make_proxy(v, "mov", tmp_path / "proxy.mp4")
    r = media.judge_probe(media.ffprobe(proxy))
    assert min(r.width, r.height) <= 540


@needs_ffmpeg
def test_real_probe_rejects_disallowed_container(tmp_path: Path) -> None:
    avi = tmp_path / "source"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=160x320:duration=1",
                    "-f", "avi", str(avi)], check=True, capture_output=True)
    with pytest.raises(StepError) as e:
        media.ffprobe(avi)
    assert e.value.code == errors.UNSUPPORTED_FORMAT


@needs_ffmpeg
def test_real_forced_demuxer_rejects_mismatch(tmp_path: Path) -> None:
    v = _make_video(tmp_path / "v.mp4", 1)
    with pytest.raises(StepError):
        media.extract_frame(v, "matroska", 0.5, tmp_path / "f.jpg")
