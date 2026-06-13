/**
 * Buy a package skill outright: one custodial buyer wallet, one real MPP
 * payment, artifact URL back. The trade lands on the ledger as kind=purchase
 * and streams to /activity live.
 *
 *   pnpm --filter @aas/payments buy llm-wiki
 *   API_URL=https://aas-api-xruj.onrender.com pnpm --filter @aas/payments buy llm-wiki
 */
import type { PurchaseResponse, SkillListing } from "@aas/contracts";
import { createBuyerWallet } from "../src/index.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const skillId = process.argv[2];
if (!skillId) {
  console.error("usage: pnpm --filter @aas/payments buy <skillId>");
  process.exit(1);
}

const skill = (await fetch(`${API}/skills/${skillId}`).then((r) => r.json())) as SkillListing;
if (!skill.id) {
  console.error(`skill ${skillId} not found at ${API}`);
  process.exit(1);
}
console.log(`buying ${skill.name} (${skill.type}, $${skill.priceUsd}) from ${skill.ownerAgent}...`);

const buyer = await createBuyerWallet("collector-001.agent");
const res = await buyer.fetch(`${API}/skills/${skillId}/purchase`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ buyerAgent: buyer.name }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`purchase failed ${res.status}: ${text}`);
  process.exit(1);
}
const body = JSON.parse(text) as PurchaseResponse;
console.log(`receipt:  ${body.receipt}`);
console.log(`artifact: ${body.artifactUrl}`);
console.log(`done — watch it at /activity (tagged "bought")`);
