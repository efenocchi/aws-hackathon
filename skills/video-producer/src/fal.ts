import { CONFIG } from "./config.js";

interface QueueSubmit {
  request_id: string;
  status_url: string;
  response_url: string;
}

/** Submits to fal's queue API and polls until the result is ready. */
export async function falRun<T>(modelId: string, input: Record<string, unknown>): Promise<T> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");

  const submit = await fetch(`${CONFIG.fal.baseUrl}/${modelId}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`fal submit ${modelId} ${submit.status}: ${await submit.text()}`);
  const { status_url, response_url } = (await submit.json()) as QueueSubmit;

  const deadline = Date.now() + CONFIG.fal.timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, CONFIG.fal.pollIntervalMs));
    const st = await fetch(status_url, { headers: { Authorization: `Key ${key}` } });
    const status = (await st.json()) as { status: string };
    if (status.status === "COMPLETED") {
      const res = await fetch(response_url, { headers: { Authorization: `Key ${key}` } });
      if (!res.ok) throw new Error(`fal result ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    }
    if (status.status === "FAILED" || status.status === "ERROR")
      throw new Error(`fal job failed: ${JSON.stringify(status)}`);
  }
  throw new Error(`fal job timed out after ${CONFIG.fal.timeoutMs}ms (${modelId})`);
}

export interface FalImageResult {
  images: Array<{ url: string }>;
}

export interface FalVideoResult {
  video: { url: string };
}
