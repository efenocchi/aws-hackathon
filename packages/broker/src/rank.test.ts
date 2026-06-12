/**
 * Determinism and ordering of the broker's skill ranker.
 *   pnpm --filter @aas/broker test
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { SkillListing } from "@aas/contracts";
import { rankSkills, tokenize } from "./rank.js";

function listing(over: Partial<SkillListing>): SkillListing {
  return {
    id: "x",
    name: "X",
    ownerAgent: "agent.x",
    type: "service",
    priceUsd: 1,
    description: "",
    category: "other",
    rating: 4,
    downloads: 0,
    tags: [],
    createdAt: "2026-06-12T00:00:00Z",
    ...over,
  };
}

const copywriter = listing({
  id: "copywriter",
  name: "Launch Copywriter",
  category: "copywriting",
  rating: 4.7,
  priceUsd: 0.4,
  tags: ["copy", "launch", "marketing"],
  description: "Launch announcements, taglines, and landing copy.",
});
const video = listing({
  id: "video-producer",
  name: "Video Producer",
  category: "video",
  rating: 4.9,
  priceUsd: 2.5,
  tags: ["video", "promo", "advertising"],
  description: "Full promo-video production.",
});
const scheduler = listing({
  id: "social-scheduler",
  name: "Social Launch Scheduler",
  category: "marketing",
  rating: 4.4,
  priceUsd: 0.3,
  tags: ["social", "scheduling"],
  description: "Pushes launch assets to Slack, X, and YouTube.",
});

test("keyword overlap dominates: launch goal picks the copywriter", () => {
  const ranked = rankSkills("launch a promo campaign", [video, scheduler, copywriter]);
  assert.equal(ranked[0].skill.id, "copywriter");
  assert.ok(ranked[0].score > ranked[1].score, "clear winner, not a tiebreak");
});

test("category beats tags, video goal picks the producer", () => {
  const ranked = rankSkills("produce a promo video spot", [copywriter, scheduler, video]);
  assert.equal(ranked[0].skill.id, "video-producer");
});

test("equal score ties break by rating desc, then price asc, then id", () => {
  const a = listing({ id: "a", rating: 4.5, priceUsd: 2 });
  const b = listing({ id: "b", rating: 4.5, priceUsd: 1 });
  const c = listing({ id: "c", rating: 4.9, priceUsd: 9 });
  const ranked = rankSkills("zzz nothing matches", [a, b, c]);
  assert.deepEqual(
    ranked.map((r) => r.skill.id),
    ["c", "b", "a"],
  );
  assert.ok(ranked.every((r) => r.score === 0));
});

test("input order never changes the result (determinism)", () => {
  const pool = [video, scheduler, copywriter];
  const expected = rankSkills("launch a promo campaign", pool).map((r) => r.skill.id);
  const shuffled = rankSkills("launch a promo campaign", [copywriter, video, scheduler]);
  assert.deepEqual(shuffled.map((r) => r.skill.id), expected);
});

test("tokenize drops stopwords and short words", () => {
  assert.deepEqual(tokenize("Launch a promo campaign for the team!"), [
    "launch",
    "promo",
    "campaign",
    "team",
  ]);
});
