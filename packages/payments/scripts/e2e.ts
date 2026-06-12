/**
 * End-to-end proof of real MPP payments on Tempo testnet.
 *
 * Boots the marketplace API in-process, then asserts:
 *   1. unpaid execute -> 402 + WWW-Authenticate challenge, no transaction
 *   2. paid execute via createBuyerWallet -> { jobId } + transaction recorded
 *      with the real on-chain receipt (tx hash)
 *   3. on-chain pathUSD: buyer balance decreased and owner agent balance
 *      increased by exactly the skill price
 *
 * Uses the market-research skill: its runJob path is the inline stub, so the
 * job completes without FAL_KEY/AWS credentials.
 */
import assert from "node:assert/strict";
import type { JobStatus, SkillListing, Transaction } from "@aas/contracts";
import { formatUnits, parseUnits } from "viem";
import {
  PATH_USD_DECIMALS,
  createBuyerWallet,
  getAgentWallet,
  pathUsdBalance,
} from "../src/index.js";

const PORT = 4517;
process.env.PORT = String(PORT);
const BASE = `http://localhost:${PORT}`;
const SKILL_ID = "market-research";

const fmt = (raw: bigint) => `${formatUnits(raw, PATH_USD_DECIMALS)} pathUSD`;

console.log("booting API in-process...");
await import("../../../apps/api/src/index.ts");
for (let i = 0; ; i++) {
  const ok = await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  assert.ok(i < 50, "API did not become healthy");
  await new Promise((r) => setTimeout(r, 100));
}

const skill = (await fetch(`${BASE}/skills/${SKILL_ID}`).then((r) =>
  r.json(),
)) as SkillListing;
assert.equal(skill.type, "service");
console.log(
  `skill: ${skill.id} owned by ${skill.ownerAgent}, price $${skill.priceUsd}`,
);

const transactionsAt = async () =>
  (await fetch(`${BASE}/transactions`).then((r) => r.json())) as Transaction[];

// --- 1. unpaid execute -> genuine 402 challenge, no job, no transaction ----
const unpaid = await fetch(`${BASE}/skills/${SKILL_ID}/execute`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ brief: "unpaid probe", buyerAgent: "freeloader" }),
});
assert.equal(unpaid.status, 402, "unpaid execute must return 402");
const challenge = unpaid.headers.get("www-authenticate");
assert.ok(challenge, "402 must carry a WWW-Authenticate challenge");
const unpaidBody = await unpaid.text();
assert.ok(!unpaidBody.includes("jobId"), "unpaid execute must not create a job");
assert.equal(
  (await transactionsAt()).length,
  0,
  "unpaid execute must not record a transaction",
);
console.log("PASS 1: unpaid -> 402, challenge:", challenge.slice(0, 80) + "...");

// --- 2. paid execute via buyer wallet -> jobId + real receipt --------------
const buyer = await createBuyerWallet("e2e.buyer");
const seller = await getAgentWallet(skill.ownerAgent);
console.log(`buyer ${buyer.address}, seller(${skill.ownerAgent}) ${seller.address}`);

const buyerBefore = await pathUsdBalance(buyer.address);
const sellerBefore = await pathUsdBalance(seller.address);
console.log(`before: buyer ${fmt(buyerBefore)}, seller ${fmt(sellerBefore)}`);

const paid = await buyer.fetch(`${BASE}/skills/${SKILL_ID}/execute`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    brief: "competitive brief for the Agent App Store",
    buyerAgent: "e2e.buyer",
  }),
});
assert.equal(paid.status, 200, "paid execute must return 200");
assert.ok(
  paid.headers.get("payment-receipt"),
  "paid response must carry the Payment-Receipt header",
);
const { jobId } = (await paid.json()) as { jobId: string };
assert.ok(jobId, "paid execute must return a jobId");

const txs = await transactionsAt();
assert.equal(txs.length, 1, "exactly one transaction must be recorded");
const tx = txs[0];
assert.equal(tx.skillId, SKILL_ID);
assert.equal(tx.buyerAgent, "e2e.buyer");
assert.equal(tx.sellerAgent, skill.ownerAgent);
assert.equal(tx.amountUsd, skill.priceUsd);
assert.notEqual(tx.receipt, "mock-pending-mpp-integration");
assert.match(
  tx.receipt,
  /^0x[0-9a-fA-F]{64}$/,
  "receipt must be the real Tempo tx hash",
);
console.log(`PASS 2: paid -> jobId ${jobId}, receipt ${tx.receipt}`);

// the stub job completes inline — confirm the purchased execution succeeds
for (let i = 0; ; i++) {
  const job = (await fetch(`${BASE}/jobs/${jobId}`).then((r) =>
    r.json(),
  )) as JobStatus;
  if (job.status === "succeeded") break;
  assert.notEqual(job.status, "failed", `job failed: ${job.error}`);
  assert.ok(i < 100, "job did not complete in time");
  await new Promise((r) => setTimeout(r, 200));
}

// --- 3. on-chain pathUSD moved by exactly the price ------------------------
const buyerAfter = await pathUsdBalance(buyer.address);
const sellerAfter = await pathUsdBalance(seller.address);
console.log(`after:  buyer ${fmt(buyerAfter)}, seller ${fmt(sellerAfter)}`);

const price = parseUnits(String(skill.priceUsd), PATH_USD_DECIMALS);
assert.equal(
  sellerAfter - sellerBefore,
  price,
  "seller balance must increase by exactly the price",
);
// Tempo charges the network fee in pathUSD, so the buyer pays price + gas.
const buyerSpent = buyerBefore - buyerAfter;
assert.ok(
  buyerSpent >= price,
  `buyer balance must decrease by at least the price (spent ${fmt(buyerSpent)})`,
);
console.log(
  `PASS 3: on-chain transfer of ${fmt(price)} buyer -> ${skill.ownerAgent}` +
    ` (buyer also paid ${fmt(buyerSpent - price)} network fee)`,
);

console.log("\nALL PASS: real MPP payment on Tempo testnet, end to end");
process.exit(0);
