# Dervaish Video Generator Worker

This worker adapts the MoviePy renderer from the existing `video-gen` sample into a JSON-driven command.

It accepts a job payload from stdin or `--job`, reads layout CSV files, renders up to three visible lyric languages, and writes an MP4 plus preview frame to the configured output directory.

## Local Usage

```bash
python workers/video-generator/render_job.py --job workers/video-generator/sample-job.json
```

Set `IMAGEMAGICK_BINARY` when MoviePy `TextClip` needs an explicit ImageMagick path.

