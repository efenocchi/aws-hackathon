/**
 * OpenUI chain smoke test (no fal spend): director emits OpenUI Lang for a fake
 * deliverable -> parser validates it against the component library.
 *   pnpm --filter @aas/api exec tsx src/openui-smoke.ts
 */
import { OPENUI_SYSTEM_PROMPT, deliverableLibrary } from "@aas/openui-lib";
import { createParser } from "@openuidev/react-lang";
import { complete } from "@aas/video-producer";

const fakeData = {
  concept: "A single sheet of luminous paper in a dark archive, light threads converging into it.",
  tagline: "Publish once. Cited everywhere.",
  shots: ["The Convergence", "The Index Awakens", "First Citation"],
  keyframeUrls: [
    "https://example.com/kf1.jpg",
    "https://example.com/kf2.jpg",
    "https://example.com/kf3.jpg",
  ],
  videoUrl: "/renders/demo-promo.mp4",
};

console.log("Asking the agent to design its deliverable view...");
const openui = await complete(OPENUI_SYSTEM_PROMPT, JSON.stringify(fakeData));
console.log("--- agent output ---\n" + openui + "\n--------------------");

const parser = createParser(deliverableLibrary.toJSONSchema());
const result = parser.parse(openui);
const critical = result.meta.errors.filter((e) => e.code === "unknown-component");
console.log(`parse errors: ${result.meta.errors.length} (critical: ${critical.length})`);
if (critical.length) {
  console.error(critical);
  process.exit(1);
}
console.log("✅ OpenUI chain OK — agent output parses against the library");
