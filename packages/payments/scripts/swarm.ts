/**
 * Swarm demo driver: spawn N buyer agents, each with its own custodial wallet
 * on Tempo testnet, and fire M paid skill executions at a RUNNING marketplace
 * API. Every trade is a real MPP payment (402 -> pay -> receipt) — watch them
 * stream into the storefront's /activity dashboard live.
 *
 *   pnpm --filter @aas/payments swarm                          # 6 agents, 18 trades
 *   SWARM_AGENTS=100 SWARM_TRADES=300 pnpm --filter @aas/payments swarm
 *
 * Skills needing external keys (video, weather) or an LLM (copywriter) are
 * excluded by default; override the pool with SWARM_SKILLS=id1,id2.
 */
import type { SkillListing } from "@aas/contracts";
import { createBuyerWallet, type BuyerWallet } from "../src/index.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const AGENTS = Number(process.env.SWARM_AGENTS ?? 6);
const TRADES = Number(process.env.SWARM_TRADES ?? 18);
const CONCURRENCY = Number(process.env.SWARM_CONCURRENCY ?? 4);
const EXCLUDED = new Set(
  (process.env.SWARM_EXCLUDE ?? "video-producer,weather-promo,copywriter").split(","),
);

// Concrete product concepts: they read well in research/social copy AND give
// the poster-studio image model something it can actually draw.
const BRIEFS = [
  "launch of a niche perfume — amber glass bottle, dusk light, quiet luxury",
  "limited-edition mechanical keyboard for developers, brushed aluminum, midnight palette",
  "specialty coffee subscription for remote engineering teams",
  "AI hardware wearable: a discreet brass pin with ambient light",
  "indie studio launching a cozy space-exploration game",
  "electric cargo bike for city families, cream and forest green",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  const healthy = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
  if (!healthy) {
    console.error(`API at ${API} is not reachable — start it first (pnpm --filter @aas/api dev)`);
    process.exit(1);
  }

  const all = (await fetch(`${API}/skills`).then((r) => r.json())) as SkillListing[];
  const pool = process.env.SWARM_SKILLS
    ? all.filter((s) => process.env.SWARM_SKILLS!.split(",").includes(s.id))
    : all.filter((s) => s.type === "service" && !EXCLUDED.has(s.id));
  if (pool.length === 0) {
    console.error("no tradable skills in the pool");
    process.exit(1);
  }
  console.log(
    `trading pool: ${pool.map((s) => `${s.id}($${s.priceUsd})`).join(", ")}`,
  );

  // Wallet creation hits the testnet faucet — batch it gently.
  console.log(`funding ${AGENTS} buyer agents on Tempo testnet...`);
  const agents: BuyerWallet[] = [];
  for (let i = 0; i < AGENTS; i += CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, AGENTS - i) }, (_, j) =>
        createBuyerWallet(`swarm-${String(i + j + 1).padStart(3, "0")}.agent`),
      ),
    );
    agents.push(...batch);
    console.log(`  ${agents.length}/${AGENTS} agents ready`);
  }

  let done = 0;
  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function trade(n: number) {
    const agent = pick(agents);
    const skill = pick(pool);
    try {
      const attempt = () =>
        agent.fetch(`${API}/skills/${skill.id}/execute`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brief: pick(BRIEFS), buyerAgent: agent.name }),
        });
      let res = await attempt();
      if (res.status === 402) {
        // Cold wallet: faucet funds may not be visible on-chain yet. One retry.
        await new Promise((r) => setTimeout(r, 1500));
        res = await attempt();
      }
      const body = (await res.json()) as { jobId?: string; error?: string };
      if (res.status === 200 && body.jobId) {
        ok++;
        console.log(
          `[${++done}/${TRADES}] ${agent.name} bought ${skill.id} for $${skill.priceUsd} -> job ${body.jobId.slice(0, 8)}`,
        );
      } else {
        failed++;
        console.log(`[${++done}/${TRADES}] ${agent.name} -> ${skill.id} FAILED ${res.status}: ${body.error ?? ""}`);
      }
    } catch (err) {
      failed++;
      console.log(`[${++done}/${TRADES}] trade ${n} ERROR: ${String((err as Error).message)}`);
    }
  }

  // Fixed-size worker pool over TRADES tasks.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, TRADES) }, async () => {
      while (next < TRADES) await trade(next++);
    }),
  );

  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nswarm done: ${ok} settled, ${failed} failed, ${AGENTS} agents, ${secs}s` +
      ` — watch them at /activity`,
  );
  process.exit(ok > 0 ? 0 : 1);
}

await main();
