# 분석 워커(Railway). 비밀은 Railway 변수로만 주입한다(이미지에 넣지 않음).
# 기반 이미지는 다이제스트로 고정(python:3.14-slim-trixie, 2026-11-19 확인).
FROM python:3.14-slim-trixie@sha256:9aaa474097d094040649f2162a627c0049b408f52138d980916788d80f04802f

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    WORK_DIR=/tmp/gss-worker WHISPER_MODEL=/opt/whisper-small \
    OPENCV_FFMPEG_CAPTURE_OPTIONS="protocol_whitelist;file"

# ffmpeg(ffprobe 포함). FFmpeg(GPL 빌드·libx264)는 서버 내부 실행만, 이미지 비배포 — 사용자 승인 예외(task-006 계약 7장).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# 잠금 파일이 전체 의존성이다(해시 검증). opencv-python 대신 headless를 쓰려고 --no-deps.
RUN pip install --require-hashes --no-deps --only-binary=:all: -r requirements.txt

# faster-whisper small 모델을 revision 고정으로 이미지에 받아 둔다(첫 작업 지연·모델 바꿔치기 방지)
ARG WHISPER_REPO=Systran/faster-whisper-small
ARG WHISPER_REVISION=536b0662742c02347bc0e980a01041f333bce120
RUN python -c "import sys; from huggingface_hub import snapshot_download; \
snapshot_download(sys.argv[1], revision=sys.argv[2], local_dir='/opt/whisper-small')" \
    "$WHISPER_REPO" "$WHISPER_REVISION"

COPY app ./app
RUN useradd --create-home --uid 10001 worker
USER worker

CMD ["python", "-m", "app.main"]
