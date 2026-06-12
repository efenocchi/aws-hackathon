import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { CONFIG } from "./config.js";
import { directStoryboard } from "./director.js";
import { falRun, type FalImageResult, type FalVideoResult } from "./fal.js";
import { runwareImage, runwareVideo } from "./runware.js";

/**
 * Render provider: fal / runware — whichever has a key — or "mock" (zero-spend
 * rehearsal: placeholder keyframes + the local test clip). VIDEO_PROVIDER forces.
 * NOTE: while spend is gated, mock is the default even when keys exist.
 */
function renderProvider(): "fal" | "runware" | "mock" {
  const forced = process.env.VIDEO_PROVIDER as "fal" | "runware" | "mock" | undefined;
  if (forced) return forced;
  if (process.env.RENDER_SPEND_APPROVED === "1") {
    if (process.env.FAL_KEY) return "fal";
    if (process.env.RUNWARE_API_KEY) return "runware";
  }
  return "mock";
}

/** Zero-spend stand-ins so the full demo loop can be rehearsed. */
const MOCK = {
  keyframe: (i: number) => `https://picsum.photos/seed/aas-shot-${i}/1280/720`,
  clip: () => new URL("../../../renders/test-promo.mp4", import.meta.url).pathname,
};

const execFileP = promisify(execFile);

export { complete, directStoryboard } from "./director.js";

export interface ProduceOptions {
  onProgress?: (line: string) => void;
  params?: Record<string, unknown>;
}

export interface ProduceResult {
  /** Local path (apps/api serves it) or S3 URL of the stitched video. */
  videoUrl: string;
  extras: Record<string, string>;
}

/**
 * The flagship skill: brief in, finished promo video out.
 * Director (Claude) → keyframes (image model) → clips (i2v model, parallel) → ffmpeg stitch.
 */
export async function produceVideo(
  brief: string,
  { onProgress = () => {}, params }: ProduceOptions = {},
): Promise<ProduceResult> {
  const t0 = Date.now();
  const provider = renderProvider();
  const videoModel = (params?.videoModel as string) ?? CONFIG.fal.videoModel;

  onProgress(`🎬 Director is writing the concept for: "${brief}"`);
  const board = await directStoryboard(brief, CONFIG.shots.count);
  onProgress(`📋 Concept: ${board.concept}`);
  onProgress(`🪧 Tagline: "${board.tagline}" — ${board.shots.length} shots`);

  onProgress(`🖼️ Rendering ${board.shots.length} keyframes (${provider})...`);
  const keyframes = await Promise.all(
    board.shots.map((shot, i) =>
      provider === "mock"
        ? Promise.resolve(MOCK.keyframe(i))
        : provider === "runware"
          ? runwareImage(shot.imagePrompt)
          : falRun<FalImageResult>(CONFIG.fal.imageModel, {
              prompt: shot.imagePrompt,
              image_size: "landscape_16_9",
              num_images: 1,
            }).then((r) => r.images[0].url),
    ),
  );
  onProgress(`🖼️ Keyframes done in ${sec(t0)}s`);

  onProgress(`🎥 Animating ${board.shots.length} shots in parallel (${provider})...`);
  const clips = await Promise.all(
    board.shots.map((shot, i) =>
      (provider === "mock"
        ? new Promise<string>((r) => setTimeout(() => r(MOCK.clip()), 1500 + i * 700))
        : provider === "runware"
          ? runwareVideo(keyframes[i], shot.motionPrompt, CONFIG.shots.secondsPerShot)
          : falRun<FalVideoResult>(videoModel, {
              image_url: keyframes[i],
              prompt: shot.motionPrompt,
              duration: CONFIG.shots.secondsPerShot,
              resolution: CONFIG.shots.resolution,
            }).then((r) => r.video.url)
      ).then((url) => {
        onProgress(`  ✓ shot ${i + 1}/${board.shots.length}: ${shot.title}`);
        return url;
      }),
    ),
  );

  onProgress(`🎞️ Stitching ${clips.length} clips...`);
  const outPath = await stitch(clips);
  onProgress(`✅ Done in ${sec(t0)}s → ${outPath}`);

  return {
    videoUrl: outPath,
    extras: {
      concept: board.concept,
      tagline: board.tagline,
      storyboard: JSON.stringify(board.shots.map((s) => s.title)),
      keyframes: JSON.stringify(keyframes),
      clips: JSON.stringify(clips),
    },
  };
}

/**
 * Single-image production: brief in, campaign key art out. Same provider and
 * spend gating as produceVideo; mock is a deterministic placeholder.
 */
export async function produceImage(
  prompt: string,
  { onProgress = () => {} }: ProduceOptions = {},
): Promise<{ url: string; extras: Record<string, string> }> {
  const t0 = Date.now();
  const provider = renderProvider();
  onProgress(`🖼️ Rendering key art (${provider})...`);
  const remote =
    provider === "mock"
      ? MOCK.keyframe((prompt.length * 7) % 1000)
      : provider === "runware"
        ? await runwareImage(prompt)
        : await falRun<FalImageResult>(CONFIG.fal.imageModel, {
            prompt,
            image_size: "landscape_16_9",
            num_images: 1,
          }).then((r) => r.images[0].url);

  // Persist real renders locally so the marketplace serves a stable URL;
  // mock placeholders stay remote (nothing to persist).
  let url = remote;
  if (provider !== "mock") {
    await mkdir(CONFIG.outDir, { recursive: true });
    const p = join(CONFIG.outDir, `${Date.now().toString(36)}-poster.png`);
    const res = await fetch(remote);
    await writeFile(p, Buffer.from(await res.arrayBuffer()));
    url = p;
  }
  onProgress(`✅ Key art ready in ${sec(t0)}s`);
  return { url, extras: { prompt } };
}

async function stitch(clipUrls: string[]): Promise<string> {
  await mkdir(CONFIG.outDir, { recursive: true });
  const id = Date.now().toString(36);
  const localClips: string[] = [];
  for (let i = 0; i < clipUrls.length; i++) {
    if (clipUrls[i].startsWith("/")) {
      localClips.push(clipUrls[i]); // already on disk (mock provider)
      continue;
    }
    const p = join(CONFIG.outDir, `${id}-clip${i}.mp4`);
    const res = await fetch(clipUrls[i]);
    await writeFile(p, Buffer.from(await res.arrayBuffer()));
    localClips.push(p);
  }
  const listPath = join(CONFIG.outDir, `${id}-list.txt`);
  await writeFile(listPath, localClips.map((p) => `file '${p}'`).join("\n"));
  const outPath = join(CONFIG.outDir, `${id}-promo.mp4`);
  // Re-encode for uniform codec/timebase across clips; concat demuxer alone breaks on mixed sources.
  await execFileP("ffmpeg", [
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "24",
    "-c:a", "aac", "-y", outPath,
  ]);
  return outPath;
}

const sec = (t0: number) => Math.round((Date.now() - t0) / 1000);
