/**
 * Real gated-execute run of the broker CLI — no mocks on the payment rail.
 *
 * Stands up a minimal marketplace whose execute route is gated by the exact
 * mppx Hono middleware the real API will mount, then spawns the actual CLI
 * (`broker run`) against it and asserts the payment-visible lines appear:
 * 402 challenge (amount + recipient), credential created, receipt.
 * Settles on the live Tempo testnet, so it needs network.
 *
 *   pnpm --filter @aas/broker test
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Mppx as MppxServer, tempo as tempoServer } from "mppx/hono";
import type { JobStatus, SkillListing } from "@aas/contracts";

const PORT = 4598;

const promoBot: SkillListing = {
  id: "promo-bot",
  name: "Promo Campaign Bot",
  ownerAgent: "test.seller",
  type: "service",
  priceUsd: 0.05,
  description: "Launches a promo campaign end to end.",
  category: "marketing",
  rating: 4.2,
  downloads: 1,
  tags: ["promo", "campaign", "launch"],
  createdAt: "2026-06-12T00:00:00Z",
};

test("broker CLI pays a gated execute and prints the payment trail", { timeout: 180_000 }, async () => {
  const seller = privateKeyToAccount(generatePrivateKey());
  const gate = MppxServer.create({
    secretKey: generatePrivateKey(),
    methods: [tempoServer({ testnet: true, recipient: seller.address })],
  });

  const job: JobStatus = {
    jobId: "job-gated-1",
    skillId: promoBot.id,
    status: "succeeded",
    progress: ["campaign assets generated", "posts scheduled"],
    deliverable: { url: "https://example.com/campaign.md" },
    createdAt: "2026-06-12T00:00:00Z",
    updatedAt: "2026-06-12T00:00:00Z",
  };

  const app = new Hono();
  app.get("/skills", (c) => c.json([promoBot]));
  app.post("/skills/promo-bot/execute", gate.charge({ amount: "0.05" }), (c) =>
    c.json({ jobId: job.jobId }),
  );
  app.get("/jobs/job-gated-1", (c) => c.json(job));
  const server = serve({ fetch: app.fetch, port: PORT });

  try {
    const { stdout } = await promisify(execFile)(
      "npx",
      ["tsx", join(import.meta.dirname, "index.ts"), "run", "launch a promo campaign"],
      {
        env: { ...process.env, MARKET_URL: `http://localhost:${PORT}` },
        timeout: 150_000,
      },
    );

    assert.match(stdout, /\[broker\] selected: Promo Campaign Bot \(promo-bot\)/);
    assert.match(
      stdout,
      new RegExp(`\\[pay\\] 402 challenge received: 0\\.05 pathUSD -> ${seller.address}`),
    );
    assert.match(stdout, /\[pay\] credential created \(method: tempo\)/);
    assert.match(stdout, /\[pay\] payment accepted — receipt: .+/);
    assert.doesNotMatch(stdout, /no challenge — endpoint ungated/);
    assert.match(stdout, /\[broker\] job succeeded/);
    assert.match(stdout, /\[broker\] deliverable: https:\/\/example\.com\/campaign\.md/);
  } finally {
    server.close();
  }
});
