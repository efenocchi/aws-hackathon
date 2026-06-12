/**
 * All model/provider choices in one place. fal model ids are env-overridable
 * because exact slugs must be confirmed against fal's model pages with a live
 * key (run `pnpm --filter @aas/video-producer smoke` after setting FAL_KEY).
 */
export const CONFIG = {
  fal: {
    baseUrl: "https://queue.fal.run",
    // Keyframe image model — cheap and fast.
    imageModel: process.env.FAL_IMAGE_MODEL ?? "fal-ai/flux/schnell",
    // Primary video model — Wan 2.6 Flash i2v: $0.05/s, 1080p, native audio, ~20s/clip.
    videoModel: process.env.FAL_VIDEO_MODEL ?? "fal-ai/wan/v2.6/image-to-video",
    // Pre-render hero model (run manually, slower/prettier).
    heroVideoModel: process.env.FAL_HERO_MODEL ?? "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    // Emergency-speed fallback.
    fallbackVideoModel: process.env.FAL_FALLBACK_MODEL ?? "fal-ai/ltx-2/image-to-video/fast",
    pollIntervalMs: 2_000,
    timeoutMs: 8 * 60_000,
  },
  director: {
    // Claude on Bedrock. Swap via env once we confirm which ids the hackathon
    // account has enabled (Fable 5 went GA on Bedrock 2026-06-09).
    bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region: process.env.AWS_REGION ?? "us-west-2",
    // Optional TrueFoundry gateway (OpenAI-compatible) — used when key is set,
    // giving per-skill cost metering for the marketplace story.
    truefoundryBaseUrl: process.env.TRUEFOUNDRY_BASE_URL,
    truefoundryApiKey: process.env.TRUEFOUNDRY_API_KEY,
    truefoundryModel: process.env.TRUEFOUNDRY_MODEL ?? "bedrock/claude-sonnet-4-5",
  },
  shots: {
    count: Number(process.env.SHOT_COUNT ?? 5),
    secondsPerShot: Number(process.env.SECONDS_PER_SHOT ?? 5),
    resolution: process.env.VIDEO_RESOLUTION ?? "1080p",
  },
  outDir: process.env.RENDERS_DIR ?? new URL("../../../renders/", import.meta.url).pathname,
};
