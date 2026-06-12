/**
 * Runware render provider — alternative to fal. Task-array REST API:
 * POST https://api.runware.ai/v1 with Bearer auth; video tasks run async and
 * are polled via getResponse. Model AIR ids are env-configured — verify against
 * runware.ai/models with `pnpm --filter @aas/video-producer smoke`.
 */
import { randomUUID } from "node:crypto";

const BASE = process.env.RUNWARE_BASE_URL ?? "https://api.runware.ai/v1";

const MODELS = {
  // AIR ids verified via modelSearch 2026-06-12.
  image: process.env.RUNWARE_IMAGE_MODEL ?? "runware:100@1", // FLUX Schnell
  video: process.env.RUNWARE_VIDEO_MODEL ?? "alibaba:wan@2.6-flash", // Wan 2.6 Flash i2v
};

interface RunwareItem {
  taskType: string;
  taskUUID: string;
  status?: string;
  imageURL?: string;
  videoURL?: string;
  [k: string]: unknown;
}

async function post(tasks: Record<string, unknown>[]): Promise<RunwareItem[]> {
  const key = process.env.RUNWARE_API_KEY;
  if (!key) throw new Error("RUNWARE_API_KEY not set");
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(tasks),
  });
  const body = (await res.json()) as { data?: RunwareItem[]; errors?: unknown[] };
  if (!res.ok || body.errors?.length)
    throw new Error(`runware ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 500)}`);
  for (const item of body.data ?? [])
    if (item.cost !== undefined) console.log(`[runware] ${item.taskType} cost: $${item.cost}`);
  return body.data ?? [];
}

export async function runwareImage(prompt: string): Promise<string> {
  const [item] = await post([
    {
      taskType: "imageInference",
      taskUUID: randomUUID(),
      model: MODELS.image,
      positivePrompt: prompt,
      width: 1280,
      height: 704, // Runware requires multiples of 64 (720 is rejected)
      numberResults: 1,
      includeCost: true,
    },
  ]);
  if (!item?.imageURL) throw new Error(`runware image: no imageURL in ${JSON.stringify(item)}`);
  return item.imageURL;
}

export async function runwareVideo(
  imageUrl: string,
  motionPrompt: string,
  durationSec: number,
): Promise<string> {
  const taskUUID = randomUUID();
  await post([
    {
      taskType: "videoInference",
      taskUUID,
      model: MODELS.video,
      positivePrompt: motionPrompt,
      inputs: { frameImages: [{ image: imageUrl, frame: "first" }] },
      duration: durationSec,
      resolution: process.env.RUNWARE_VIDEO_RESOLUTION ?? "720p",
      outputType: "URL",
      outputFormat: "MP4",
      deliveryMethod: "async",
      includeCost: true,
    },
  ]);

  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3_000));
    // getResponse polls with the ORIGINAL task's UUID.
    const items = await post([{ taskType: "getResponse", taskUUID }]).catch(
      () => [] as RunwareItem[],
    );
    const hit = items.find((i) => i.videoURL);
    if (hit?.videoURL) return hit.videoURL;
    const failed = items.find((i) => i.status === "error" || i.status === "failed");
    if (failed) throw new Error(`runware video failed: ${JSON.stringify(failed).slice(0, 300)}`);
  }
  throw new Error("runware video timed out");
}
