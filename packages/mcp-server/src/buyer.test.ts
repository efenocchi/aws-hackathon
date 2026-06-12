/**
 * Real 402 round-trip for the buyer client — no mocks.
 *
 * Spins up an mppx-gated Hono endpoint (the exact middleware the marketplace
 * execute route will use), then drives the buyer's payment-aware fetch
 * through it and asserts the full event chain fires: challenge.received ->
 * credential.created -> payment.response, with a settled 200 + receipt.
 * Talks to the live Tempo testnet faucet, so it needs network.
 *
 *   pnpm --filter @aas/mcp-server test
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Mppx as MppxServer, tempo as tempoServer } from "mppx/hono";
import { createBuyer, describeChallenge, receiptOf } from "./buyer.js";

test("buyer fetch settles a real MPP 402 challenge", { timeout: 120_000 }, async () => {
  const seller = privateKeyToAccount(generatePrivateKey());

  const gate = MppxServer.create({
    secretKey: generatePrivateKey(),
    methods: [tempoServer({ testnet: true, recipient: seller.address })],
  });
  const app = new Hono();
  app.post("/skills/test-skill/execute", gate.charge({ amount: "0.05" }), (c) =>
    c.json({ jobId: "job-under-test" }),
  );
  const server = serve({ fetch: app.fetch, port: 4599 });

  try {
    const buyer = await createBuyer({
      walletFile: join(mkdtempSync(join(tmpdir(), "aas-buyer-")), "wallet.json"),
      agentPrefix: "test",
    });
    assert.notEqual(await buyer.balance(), "0", "faucet funded the new wallet");

    const events: string[] = [];
    buyer.mppx.on("challenge.received", (p) => {
      events.push(`challenge ${describeChallenge(p.challenge)}`);
      return undefined;
    });
    buyer.mppx.on("credential.created", () => {
      events.push("credential");
    });
    buyer.mppx.on("payment.response", (p) => {
      events.push(`receipt ${receiptOf(p.response) ?? "missing"}`);
    });

    const res = await buyer.fetch("http://localhost:4599/skills/test-skill/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: "test", buyerAgent: buyer.agentId }),
    });

    assert.equal(res.status, 200, "402 settled transparently");
    assert.deepEqual(await res.json(), { jobId: "job-under-test" });
    assert.ok(receiptOf(res), "settled response carries a payment-receipt header");

    assert.equal(events.length, 3, `expected 3 payment events, got: ${events}`);
    assert.match(events[0], /^challenge 0\.05 pathUSD -> 0x/);
    assert.equal(events[0].includes(seller.address), true, "paid to the seller");
    assert.equal(events[1], "credential");
    assert.match(events[2], /^receipt .+/);
  } finally {
    server.close();
  }
});
