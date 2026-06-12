/**
 * Smoke test for the video pipeline — run after setting FAL_KEY (and AWS creds).
 *   pnpm --filter @aas/video-producer smoke            # full mini run (1 shot)
 *   pnpm --filter @aas/video-producer smoke -- --dry   # director only, no fal spend
 *
 * Verifies: Bedrock/TrueFoundry director reachable, fal model slugs valid,
 * ffmpeg stitch works. Uses SHOT_COUNT=1 to cost cents.
 */
process.env.SHOT_COUNT = process.env.SHOT_COUNT ?? "1";
process.env.SECONDS_PER_SHOT = process.env.SECONDS_PER_SHOT ?? "5";

const { directStoryboard } = await import("./director.js");
const { produceVideo } = await import("./index.js");

const brief = "A 5-second teaser for cited.md — the publishing endpoint of the agentic web.";

if (process.argv.includes("--dry")) {
  const board = await directStoryboard(brief, 1);
  console.log(JSON.stringify(board, null, 2));
  console.log("\n✅ director OK (no fal spend)");
} else {
  const result = await produceVideo(brief, { onProgress: (l) => console.log(l) });
  console.log("\n✅ full pipeline OK:", result.videoUrl);
}
