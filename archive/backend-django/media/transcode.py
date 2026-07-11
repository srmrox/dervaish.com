"""FFmpeg/ffprobe wrappers + encoding profiles (master plan §12).

Thin, side-effecting functions kept separate from the Celery orchestration so the
task can be unit-tested by mocking this module. Binaries are configurable via
``FFMPEG_BINARY`` / ``FFPROBE_BINARY`` (the Docker image ships ffmpeg).
"""
from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field

FFMPEG = os.getenv("FFMPEG_BINARY", "ffmpeg")
FFPROBE = os.getenv("FFPROBE_BINARY", "ffprobe")


@dataclass(frozen=True)
class Profile:
    variant: str            # storage-key segment, e.g. "opus-128"
    container: str          # MediaRendition.container, e.g. "opus"
    ext: str
    codec: str
    bitrate_kbps: int | None
    height: int | None
    is_streaming: bool
    is_offline_download: bool
    ffmpeg_args: list[str] = field(default_factory=list)


# One streaming variant + one offline-download file per kind keeps on-device
# management simple (§4A: a single progressive file per offline rendition).
AUDIO_PROFILES = [
    Profile("opus-128", "opus", "opus", "libopus", 128, None, True, True,
            ["-vn", "-c:a", "libopus", "-b:a", "128k"]),
    Profile("aac-128", "aac", "m4a", "aac", 128, None, True, False,
            ["-vn", "-c:a", "aac", "-b:a", "128k"]),
]
VIDEO_PROFILES = [
    Profile("mp4-720", "mp4", "mp4", "h264", None, 720, True, True,
            ["-c:v", "libx264", "-crf", "23", "-preset", "medium",
             "-vf", "scale=-2:720", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]),
]


def profiles_for(kind: str) -> list[Profile]:
    return {"audio": AUDIO_PROFILES, "video": VIDEO_PROFILES}.get(kind, [])


def ffprobe_metadata(path: str) -> dict:
    """Return {duration_ms, width, height} for a media file (best-effort)."""
    out = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path],
        check=True, capture_output=True, text=True,
    )
    data = json.loads(out.stdout or "{}")
    meta: dict = {"duration_ms": 0, "width": None, "height": None}
    duration = (data.get("format") or {}).get("duration")
    if duration:
        meta["duration_ms"] = int(float(duration) * 1000)
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            meta["width"] = stream.get("width")
            meta["height"] = stream.get("height")
            break
    return meta


def run_ffmpeg(input_path: str, output_path: str, args: list[str]) -> None:
    subprocess.run(
        [FFMPEG, "-y", "-i", input_path, *args, output_path],
        check=True, capture_output=True, text=True,
    )


def make_poster(input_path: str, output_path: str, at: str = "00:00:01") -> None:
    subprocess.run(
        [FFMPEG, "-y", "-ss", at, "-i", input_path, "-frames:v", "1", output_path],
        check=True, capture_output=True, text=True,
    )
