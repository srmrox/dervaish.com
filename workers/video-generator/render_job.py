#!/usr/bin/env python3
"""Render a Dervaish lyric video job with MoviePy.

The TypeScript API queues JSON payloads shaped like sample-job.json. This worker
keeps the sample renderer's CSV layout model but removes folder scanning and the
Django API wrapper so it can run as a background command.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from PIL import Image

if os.environ.get("IMAGEMAGICK_BINARY"):
    from moviepy.config import change_settings

    change_settings({"IMAGEMAGICK_BINARY": os.environ["IMAGEMAGICK_BINARY"]})

from moviepy.editor import AudioFileClip, CompositeVideoClip, ImageClip, TextClip, VideoFileClip, VideoClip


def dimensions(resolution: str) -> tuple[int, int]:
    return {
        "720p": (1280, 720),
        "1080p": (1920, 1080),
        "4k": (3840, 2160),
    }.get(resolution, (1920, 1080))


def get_value(frame: pd.DataFrame, key: str, col: int) -> Any:
    rows = frame[frame.iloc[:, 0] == key]
    if rows.empty:
        return None
    return rows.iloc[0, col]


def color_from_row(row: pd.Series) -> tuple[int, int, int, int]:
    return (int(row["r"]), int(row["g"]), int(row["b"]), int(row.get("a", 255)))


def make_background(width: int, height: int, duration: float, color: tuple[int, int, int]) -> VideoClip:
    def make_frame(_: float) -> np.ndarray:
        screen = np.zeros((height, width, 3), dtype=np.uint8)
        screen[:, :] = color
        return screen

    return VideoClip(make_frame, duration=duration)


def load_image(path: Path, width: int, height: int) -> ImageClip:
    image = Image.open(path)
    if image.mode == "P":
        image = image.convert("RGBA")
    image = image.resize((width, height))
    return ImageClip(np.array(image))


def render_job(job: dict[str, Any]) -> dict[str, str]:
    source_path = Path(job["sourcePath"]).expanduser().resolve()
    layout_path = Path(job["layoutPath"]).expanduser().resolve()
    output_dir = Path(job.get("outputDir", "tmp/video-output")).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    layout_df = pd.read_csv(layout_path)
    width, height = dimensions(job.get("resolution", "1080p"))
    layout_width = int(get_value(layout_df, "layout_width", 1) or width)
    layout_height = int(get_value(layout_df, "layout_height", 1) or height)
    fps = int(get_value(layout_df, "layout_fps", 1) or 24)
    scale = height / layout_height
    output_width = int(layout_width * scale)
    output_height = int(layout_height * scale)

    visible_languages = job.get("visibleLanguages", [])[:3]
    segments = job.get("segments", [])
    image_paths = {name: Path(path).expanduser().resolve() for name, path in job.get("imagePaths", {}).items()}

    if job.get("sourceMode") == "video_overlay":
      source_clip = VideoFileClip(str(source_path))
      base_clip = source_clip.resize((output_width, output_height))
      audio_clip = base_clip.audio
    else:
      audio_clip = AudioFileClip(str(source_path))
      bg_color = tuple(int(value) for value in job.get("backgroundColor", [17, 51, 0]))
      base_clip = make_background(output_width, output_height, audio_clip.duration, bg_color)

    clips = [base_clip]

    for _, row in layout_df.iterrows():
        row_type = row.get("type")
        name = row.get("name")
        if row_type == "image":
            image_file = row.get("img_file")
            image_path = image_paths.get(image_file, layout_path.parent / str(image_file))
            if not image_path.exists():
                continue
            clip = load_image(image_path, int(row["width"] * scale), int(row["height"] * scale))
            clips.append(clip.set_position((int(row["x"] * scale), int(row["y"] * scale))).set_duration(base_clip.duration))
        elif row_type == "rectangle":
            if name == "rec_lyrics" and len(visible_languages) < 1:
                continue
            if name == "rec_lang1" and len(visible_languages) < 2:
                continue
            if name == "rec_lang2" and len(visible_languages) < 3:
                continue
            image = Image.new("RGBA", (int(row["width"] * scale), int(row["height"] * scale)), color_from_row(row))
            clips.append(ImageClip(np.array(image)).set_position((int(row["x"] * scale), int(row["y"] * scale))).set_duration(base_clip.duration))
        elif row_type == "text":
            text = str(name)
            if name == "var_title":
                text = job.get("title", "")
            elif name == "var_voice":
                text = job.get("voice", "")
            elif name == "var_writer":
                text = job.get("writer", "")
            elif name == "lbl_lyrics" and visible_languages:
                text = f"LYRICS IN {visible_languages[0]['name']}"
            elif name == "lbl_lang1" and len(visible_languages) > 1:
                text = f"TRANSLATION IN {visible_languages[1]['name']}"
            elif name == "lbl_lang2" and len(visible_languages) > 2:
                text = f"TRANSLATION IN {visible_languages[2]['name']}"
            elif str(name).startswith("lbl_"):
                text = ""
            if text:
                clip = TextClip(text, fontsize=int(row["size"] * scale), color=row["color"], font=row["font"], align="West", size=(int(row["width"] * scale), None), method="caption")
                clips.append(clip.set_position((int(row["x"] * scale), int(row["y"] * scale))))
        elif row_type == "lyrics":
            slot = {"var_lyrics": 0, "var_lang1": 1, "var_lang2": 2}.get(name)
            if slot is None or slot >= len(visible_languages):
                continue
            language = visible_languages[slot]
            align = "East" if language.get("direction") == "rtl" else "West"
            for segment in segments:
                lyric = segment.get("textByLanguageId", {}).get(language["id"], "")
                if not lyric or lyric.isspace():
                    continue
                clip = TextClip(lyric, fontsize=int(row["size"] * scale), color=row["color"], font=row["font"], align=align, size=(int(row["width"] * scale), None), method="caption")
                clips.append(
                    clip.set_start(segment["startMs"] / 1000)
                    .set_end(segment["endMs"] / 1000)
                    .set_position((int(row["x"] * scale), int(row["y"] * scale)))
                    .crossfadein(0.5)
                    .crossfadeout(0.5)
                )

    video = CompositeVideoClip(clips, (output_width, output_height)).set_audio(audio_clip)
    job_id = job.get("jobId", "video-job")
    output_path = output_dir / f"{job_id}.mp4"
    preview_path = output_dir / f"{job_id}.png"
    video.save_frame(str(preview_path), t=min(5, max(video.duration / 2, 0)))
    video.write_videofile(str(output_path), fps=fps, threads=os.cpu_count() or 1)
    video.close()
    return {"outputPath": str(output_path), "previewPath": str(preview_path)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", help="Path to a JSON video generation job. Reads stdin when omitted.")
    args = parser.parse_args()
    if args.job:
        job = json.loads(Path(args.job).read_text(encoding="utf-8"))
    else:
        job = json.loads(os.sys.stdin.read())
    print(json.dumps(render_job(job), indent=2))


if __name__ == "__main__":
    main()
