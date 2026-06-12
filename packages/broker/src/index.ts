/**
 * Broker agent CLI — the agentic trading layer.
 *
 *   pnpm --filter @aas/broker broker run "launch a promo campaign"
 *
 * Searches the marketplace, picks the best service skill deterministically
 * (no LLM, no API keys), executes it through the payment-aware mppx client
 * (auto-settling MPP 402 challenges from its own testnet wallet), and polls
 * the job to a terminal state — printing every payment event as it happens.
 */
import { join } from "node:path";
import {
  createBuyer,
  describeChallenge,
  receiptOf,
  repoRoot,
} from "@aas/mcp-server/buyer";
import { MarketClient } from "@aas/mcp-server/market";
import { rankSkills } from "./rank.js";

const MARKET_URL = process.env.MARKET_URL ?? "http://localhost:4000";
const WALLET_FILE =
  process.env.WALLET_FILE ?? join(repoRoot(), ".data", "broker-wallet.json");

const [command, ...goalParts] = process.argv.slice(2);
const goal = goalParts.join(" ").trim();
if (command !== "run" || !goal) {
  console.error('usage: broker run "<goal>"   e.g. broker run "launch a promo campaign"');
  process.exit(1);
}

console.log(`[broker] goal: ${goal}`);
const buyer = await createBuyer({ walletFile: WALLET_FILE, agentPrefix: "broker" });
const balanceBefore = await buyer.balance();
console.log(`[broker] buyer ${buyer.agentId} — ${balanceBefore} pathUSD`);

// Payment-visible demo lines, straight from the mppx client event hooks.
let challenged = false;
buyer.mppx.on("challenge.received", (p) => {
  challenged = true;
  console.log(`[pay] 402 challenge received: ${describeChallenge(p.challenge)}`);
  return undefined;
});
buyer.mppx.on("credential.created", (p) => {
  console.log(`[pay] credential created (method: ${p.challenge.method})`);
});
let receipted = false;
buyer.mppx.on("payment.response", (p) => {
  const receipt = receiptOf(p.response);
  if (receipt) receipted = true;
  console.log(`[pay] payment accepted — receipt: ${receipt ?? "(none)"}`);
});
buyer.mppx.on("payment.failed", (p) => {
  console.log(`[pay] payment FAILED: ${String((p.error as Error)?.message ?? p.error)}`);
});

const market = new MarketClient(MARKET_URL, buyer.fetch);
const catalog = await market.search();
const services = catalog.filter((s) => s.type === "service");
console.log(
  `[broker] catalog: ${catalog.length} skills, ${services.length} executable services`,
);

const ranked = rankSkills(goal, services);
for (const { skill, score } of ranked.slice(0, 3)) {
  console.log(
    `[broker]   candidate ${skill.id} — score ${score}, rating ${skill.rating}, $${skill.priceUsd}`,
  );
}
const best = ranked[0];
if (!best || best.score === 0) {
  console.error("[broker] no service skill matches that goal");
  process.exit(1);
}
const skill = best.skill;
console.log(
  `[broker] selected: ${skill.name} (${skill.id}) by ${skill.ownerAgent} — $${skill.priceUsd} per execution`,
);

const { jobId } = await market.execute(skill.id, {
  brief: goal,
  buyerAgent: buyer.agentId,
});
if (skill.priceUsd > 0 && (!challenged || !receipted)) {
  console.error(
    "[pay] FATAL: paid service executed without an MPP challenge/receipt — seller endpoint is ungated; refusing unpaid execution",
  );
  process.exit(1);
}
console.log(`[broker] job ${jobId} accepted by seller, polling...`);

let printed = 0;
let job = await market.job(jobId);
while (job.status === "queued" || job.status === "running") {
  for (; printed < job.progress.length; printed++)
    console.log(`[job] ${job.progress[printed]}`);
  await new Promise((r) => setTimeout(r, 1000));
  job = await market.job(jobId);
}
for (; printed < job.progress.length; printed++)
  console.log(`[job] ${job.progress[printed]}`);

console.log(`[broker] job ${job.status}`);
if (job.deliverable) {
  console.log(`[broker] deliverable: ${job.deliverable.url}`);
  for (const [key, value] of Object.entries(job.deliverable.extras ?? {})) {
    const oneLine = value.length > 200 ? `${value.slice(0, 200)}...` : value;
    console.log(`[broker]   ${key}: ${oneLine.replaceAll("\n", " | ")}`);
  }
}
if (job.error) console.log(`[broker] error: ${job.error}`);
console.log(
  `[broker] wallet: ${balanceBefore} -> ${await buyer.balance()} pathUSD`,
);
process.exit(job.status === "succeeded" ? 0 : 1);
