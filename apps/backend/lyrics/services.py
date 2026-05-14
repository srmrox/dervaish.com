from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET


TIMESTAMP_RE = re.compile(r"(?:(\d{2}):)?(\d{2}):(\d{2})[,.](\d{3})")
LRC_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)")


def timestamp_to_ms(value: str) -> int:
    match = TIMESTAMP_RE.fullmatch(value.strip())
    if not match:
        raise ValueError(f"Invalid timestamp: {value}")
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    millis = int(match.group(4))
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis


def ms_to_webvtt(value: int) -> str:
    hours, remainder = divmod(value, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{millis:03}"


def parse_lyric_document(payload: str, source_format: str, language_id: str) -> list[dict]:
    source_format = source_format.lower()
    if source_format == "json":
        data = json.loads(payload)
        segments = data.get("segments", data if isinstance(data, list) else [])
        return [
            {
                "start_ms": int(segment["start_ms"]),
                "end_ms": int(segment["end_ms"]),
                "text_by_language": {str(language_id): segment.get("text") or segment.get("text_by_language", {}).get(str(language_id), "")},
            }
            for segment in segments
        ]
    if source_format == "webvtt":
        return parse_webvtt(payload, language_id)
    if source_format == "lrc":
        return parse_lrc(payload, language_id)
    if source_format == "ttml":
        return parse_ttml(payload, language_id)
    raise ValueError(f"Unsupported lyric import format: {source_format}")


def parse_webvtt(payload: str, language_id: str) -> list[dict]:
    segments = []
    blocks = re.split(r"\n\s*\n", payload.replace("\r\n", "\n").strip())
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip() and line.strip().upper() != "WEBVTT"]
        if not lines:
            continue
        timing_line = next((line for line in lines if "-->" in line), "")
        if not timing_line:
            continue
        start, end = [part.strip().split()[0] for part in timing_line.split("-->", 1)]
        text = "\n".join(line for line in lines[lines.index(timing_line) + 1 :])
        segments.append({"start_ms": timestamp_to_ms(start), "end_ms": timestamp_to_ms(end), "text_by_language": {str(language_id): text}})
    return segments


def parse_lrc(payload: str, language_id: str) -> list[dict]:
    timed_lines = []
    for line in payload.splitlines():
        match = LRC_RE.match(line.strip())
        if not match:
            continue
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        fraction = (match.group(3) or "0").ljust(3, "0")[:3]
        timed_lines.append(((minutes * 60 + seconds) * 1000 + int(fraction), match.group(4).strip()))
    segments = []
    for index, (start_ms, text) in enumerate(timed_lines):
        end_ms = timed_lines[index + 1][0] if index + 1 < len(timed_lines) else start_ms + 5000
        segments.append({"start_ms": start_ms, "end_ms": end_ms, "text_by_language": {str(language_id): text}})
    return segments


def parse_ttml(payload: str, language_id: str) -> list[dict]:
    root = ET.fromstring(payload)
    segments = []
    for element in root.iter():
        if element.tag.split("}")[-1] != "p":
            continue
        begin = element.attrib.get("begin")
        end = element.attrib.get("end")
        if not begin or not end:
            continue
        text = "".join(element.itertext()).strip()
        segments.append({"start_ms": timestamp_to_ms(begin), "end_ms": timestamp_to_ms(end), "text_by_language": {str(language_id): text}})
    return segments


def export_lyric_document(lyric_set, export_format: str) -> str:
    export_format = export_format.lower()
    languages = list(lyric_set.languages.all())
    segments = list(lyric_set.segments.all())
    primary_language = languages[0] if languages else None
    primary_id = str(primary_language.id) if primary_language else ""

    def segment_text(segment) -> str:
        return segment.text_by_language.get(primary_id) or next((text for text in segment.text_by_language.values() if text), "")

    if export_format == "json":
        return json.dumps(
            {
                "id": lyric_set.id,
                "version": lyric_set.version,
                "languages": [
                    {
                        "id": language.id,
                        "code": language.code,
                        "name": language.name,
                        "role": language.role,
                        "direction": language.direction,
                    }
                    for language in languages
                ],
                "segments": [
                    {"id": segment.id, "start_ms": segment.start_ms, "end_ms": segment.end_ms, "text_by_language": segment.text_by_language}
                    for segment in segments
                ],
            },
            ensure_ascii=False,
        )
    if export_format == "webvtt":
        cues = ["WEBVTT", ""]
        for segment in segments:
            cues.append(f"{ms_to_webvtt(segment.start_ms)} --> {ms_to_webvtt(segment.end_ms)}")
            cues.append(segment_text(segment))
            cues.append("")
        return "\n".join(cues)
    if export_format == "lrc":
        lines = []
        for segment in segments:
            minutes, remainder = divmod(segment.start_ms, 60_000)
            seconds, millis = divmod(remainder, 1000)
            lines.append(f"[{minutes:02}:{seconds:02}.{millis // 10:02}]{segment_text(segment)}")
        return "\n".join(lines)
    if export_format == "ttml":
        body = "".join(
            f'<p begin="{ms_to_webvtt(segment.start_ms)}" end="{ms_to_webvtt(segment.end_ms)}">{segment_text(segment)}</p>'
            for segment in segments
        )
        return f'<?xml version="1.0" encoding="UTF-8"?><tt><body><div>{body}</div></body></tt>'
    raise ValueError(f"Unsupported lyric export format: {export_format}")
