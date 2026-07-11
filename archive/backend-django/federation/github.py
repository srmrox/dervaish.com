"""GitHub media helpers.

Turn human-facing GitHub links into directly-fetchable raw URLs so media that
lives in a public GitHub repo can be played without a transcode pipeline, and
guess a playable container from a URL's extension. Pure functions, no DB.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

_BLOB_RE = re.compile(r"^/(?P<owner>[^/]+)/(?P<repo>[^/]+)/blob/(?P<rest>.+)$")
_RAW_RE = re.compile(r"^/(?P<owner>[^/]+)/(?P<repo>[^/]+)/raw/(?P<rest>.+)$")

_GITHUB_HOSTS = {"github.com", "www.github.com"}
_RAW_HOST = "raw.githubusercontent.com"

# Extension → playback container label (matches MediaRendition.container vocabulary).
_CONTAINER_BY_EXT = {
    "mp3": "mp3", "m4a": "aac", "aac": "aac", "opus": "opus", "ogg": "ogg",
    "oga": "ogg", "wav": "wav", "flac": "flac",
    "mp4": "mp4", "m4v": "mp4", "mov": "mov", "webm": "webm", "mkv": "mkv",
    "m3u8": "hls",
}


def is_github_url(url: str) -> bool:
    if not url:
        return False
    host = urlparse(url).netloc.lower()
    return host in _GITHUB_HOSTS or host == _RAW_HOST


def normalize_github_url(url: str) -> str:
    """Return a directly-fetchable URL for a public GitHub media link.

    - ``github.com/{owner}/{repo}/blob/{branch}/{path}`` →
      ``raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}``
    - ``github.com/{owner}/{repo}/raw/{branch}/{path}`` → the same raw form
    - ``?raw=true`` query is dropped (the raw path already serves bytes)
    - already-raw URLs and non-GitHub URLs are returned unchanged
    - empty/relative input is returned as-is
    """
    if not url:
        return url
    parsed = urlparse(url)
    if parsed.netloc.lower() not in _GITHUB_HOSTS:
        return url  # already raw, or not GitHub — leave it alone

    match = _BLOB_RE.match(parsed.path) or _RAW_RE.match(parsed.path)
    if not match:
        return url  # a repo/tree/etc. link, not a file — nothing to normalize

    owner, repo, rest = match.group("owner"), match.group("repo"), match.group("rest")
    raw = parsed._replace(
        netloc=_RAW_HOST,
        path=f"/{owner}/{repo}/{rest}",
        query="",  # drop ?raw=true and friends
    )
    return urlunparse(raw)


def guess_container(url: str) -> str:
    """Best-effort playback container from a URL's file extension."""
    path = urlparse(url).path
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return _CONTAINER_BY_EXT.get(ext, ext or "bin")
