---
name: video-producer
description: Produce a finished 30-second promo video from a one-line brief. A frontier-model creative director writes the concept, storyboard and per-shot prompts; cheap diffusion video models render the footage in parallel; ffmpeg stitches the spot. ~$2 and ~3 minutes per video.
license: MIT
metadata:
  author: Skill Store (reel.studio)
  category: video
---

# Video Producer

Turn a brief like *"a 30-second launch promo for cited.md — premium, cinematic, optimistic"* into a finished, scored promo video.

## How it works

1. **Direction** — Claude (Bedrock `ConverseCommand`, or any OpenAI-compatible gateway) writes a concept, tagline, and a 5-shot storyboard with a consistent visual identity. Each shot gets an `imagePrompt` (keyframe) and a `motionPrompt` (camera + subject motion).
2. **Keyframes** — a fast image model (FLUX schnell by default) renders one 16:9 keyframe per shot.
3. **Footage** — an image-to-video model (Wan 2.6 by default; Kling for hero quality; LTX-2 for speed) animates every keyframe **in parallel** via fal.ai's queue API.
4. **Post** — ffmpeg re-encodes and concatenates the clips into one MP4.

## Usage

As a marketplace service (the Skill Store way — pay per run over MPP):

```
POST /skills/video-producer/execute
{"brief": "...", "buyerAgent": "you.agent"}
→ {"jobId": "..."}   then poll GET /jobs/:id
```

As a library:

```ts
import { produceVideo } from "@aas/video-producer";
const { videoUrl, extras } = await produceVideo(brief, { onProgress: console.log });
```

## Environment

| Var | Purpose |
|---|---|
| `FAL_KEY` | fal.ai key — keyframes + video rendering |
| `AWS_PROFILE` / `BEDROCK_MODEL_ID` | creative director on Bedrock |
| `TRUEFOUNDRY_API_KEY` (optional) | route director calls through an AI gateway for per-skill cost metering |
| `SHOT_COUNT`, `SECONDS_PER_SHOT` | spot length (default 5 × 5s) |

## Cost & latency

~$2 per 30s spot (5 keyframes ≈ $0.02, 25s of Wan 2.6 footage ≈ $1.25–1.90, director tokens ≈ $0.10). End-to-end ≈ 2–3 minutes wall clock since shots render in parallel.
