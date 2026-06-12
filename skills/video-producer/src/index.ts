import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { CONFIG } from "./config.js";
import { directStoryboard } from "./director.js";
import { falRun, type FalImageResult, type FalVideoResult } from "./fal.js";

const execFileP = promisify(execFile);

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
  const videoModel = (params?.videoModel as string) ?? CONFIG.fal.videoModel;

  onProgress(`🎬 Director is writing the concept for: "${brief}"`);
  const board = await directStoryboard(brief, CONFIG.shots.count);
  onProgress(`📋 Concept: ${board.concept}`);
  onProgress(`🪧 Tagline: "${board.tagline}" — ${board.shots.length} shots`);

  onProgress(`🖼️ Rendering ${board.shots.length} keyframes (${CONFIG.fal.imageModel})...`);
  const keyframes = await Promise.all(
    board.shots.map((shot) =>
      falRun<FalImageResult>(CONFIG.fal.imageModel, {
        prompt: shot.imagePrompt,
        image_size: "landscape_16_9",
        num_images: 1,
      }).then((r) => r.images[0].url),
    ),
  );
  onProgress(`🖼️ Keyframes done in ${sec(t0)}s`);

  onProgress(`🎥 Animating ${board.shots.length} shots in parallel (${videoModel})...`);
  const clips = await Promise.all(
    board.shots.map((shot, i) =>
      falRun<FalVideoResult>(videoModel, {
        image_url: keyframes[i],
        prompt: shot.motionPrompt,
        duration: CONFIG.shots.secondsPerShot,
        resolution: CONFIG.shots.resolution,
      }).then((r) => {
        onProgress(`  ✓ shot ${i + 1}/${board.shots.length}: ${shot.title}`);
        return r.video.url;
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

async function stitch(clipUrls: string[]): Promise<string> {
  await mkdir(CONFIG.outDir, { recursive: true });
  const id = Date.now().toString(36);
  const localClips: string[] = [];
  for (let i = 0; i < clipUrls.length; i++) {
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
