# Day 01 / 60 — Reel edit project

Final export: 9:16, 1080x1920, 30 fps, H.264 + AAC 48 kHz, -14 LUFS, 24.6 s.

| File | What it is |
|---|---|
| `build.py` | The whole edit as code: cut list (EDL), vertical framing, colour grade, voice cleanup, captions, end card, render. |
| `captions.ass` | Styled captions (Inter SemiBold, soft shadow, gold keyword highlights) + end card text. |
| `captions.srt` | Plain captions, for uploading separately to YouTube/Instagram. |
| `edl.json` | Source in/out points of every shot and the output timeline. |

## Rebuild
Put these next to `build.py` (not committed: raw footage, personal photo, downloaded fonts and models):

```
src/video.mov          raw footage (1280x720, 30 fps)
images/1.jpg           group photo for the end card
fonts/use/             Inter-SemiBold.ttf, Inter-Medium.ttf, Inter-Regular.ttf (github.com/rsms/inter)
models/rnn/sh.rnnn     RNNoise voice model (github.com/richardpl/arnndn-models)
```

Then run `python3 build.py` (needs ffmpeg with libass). Output goes to `out/`.

## Edit decisions
- 53 s raw → 20 s of dialogue + 5 s end card. Removed setup, yawn, silences, fidgeting, filler ("yeah… go") and the camera grab.
- B-roll of typing (same take) covers "In the next 60 days I will try…".
- Jump cuts inside sentences are hidden by alternating a full-height crop and a 1.15x punch-in; each crop follows the face.
- Grade: yellow cast removed, gentle S-curve, skin kept warm, light sharpening after the 720p → 1080x1920 upscale. No vignette or stylised look.
- Audio: high-pass, RNNoise, EQ, compression, two-pass loudness normalisation to -14 LUFS, 12 ms fades on every cut. No music.
