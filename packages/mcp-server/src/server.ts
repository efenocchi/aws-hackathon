/**
 * MCP tool surface for the Agent App Store.
 * Five tools backed by the marketplace REST API; execute_skill auto-pays
 * MPP 402 challenges with this server's own testnet wallet, so the calling
 * agent needs no API key and no wallet.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Buyer } from "./buyer.js";
import { describeChallenge, receiptOf } from "./buyer.js";
import type { MarketClient } from "./market.js";

const CATEGORIES = [
  "video",
  "design",
  "copywriting",
  "research",
  "engineering",
  "marketing",
  "data",
  "other",
] as const;

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function buildMcpServer(market: MarketClient, buyer: Buyer): McpServer {
  const server = new McpServer({ name: "agent-app-store", version: "0.1.0" });

  server.registerTool(
    "search_skills",
    {
      title: "Search marketplace skills",
      description:
        "Search the Agent App Store catalog of agent-owned skills. Free-text query matches name, description and tags; optionally filter by category. Returns skill listings with id, type ('service' = pay-per-execution, 'package' = one-time artifact purchase), priceUsd, rating and owner agent. Use the id with skill_info or execute_skill.",
      inputSchema: {
        query: z.string().describe("Free-text search, e.g. 'promo video' or 'copywriting'"),
        category: z.enum(CATEGORIES).optional().describe("Optional category filter"),
      },
    },
    async ({ query, category }) => json(await market.search(query, category)),
  );

  server.registerTool(
    "skill_info",
    {
      title: "Get skill details",
      description:
        "Fetch the full listing for one skill by id: price, owner agent, rating, downloads, tags, source URL. Call before execute_skill to confirm price and that type is 'service'.",
      inputSchema: {
        skillId: z.string().describe("Skill id from search_skills, e.g. 'video-producer'"),
      },
    },
    async ({ skillId }) => json(await market.skill(skillId)),
  );

  server.registerTool(
    "execute_skill",
    {
      title: "Execute a service skill (auto-paid)",
      description:
        "Execute a 'service' skill with a natural-language brief. Payment is handled automatically: if the seller's endpoint returns an MPP 402 challenge, this server settles it from its own pathUSD testnet wallet — the caller needs no API key or wallet. Returns a jobId plus what was paid; poll job_status until the job is 'succeeded' or 'failed'.",
      inputSchema: {
        skillId: z.string().describe("Id of a type='service' skill"),
        brief: z
          .string()
          .describe("Natural-language work order, e.g. '30s launch promo for cited.md'"),
        params: z
          .record(z.unknown())
          .optional()
          .describe("Optional structured parameters the skill accepts"),
      },
    },
    async ({ skillId, brief, params }) => {
      // Scoped event capture: subscribe for the duration of this call only,
      // and only record events for this skill's execute URL.
      const payment: string[] = [];
      let challenged = false;
      let receipted = false;
      const mine = (input: unknown) =>
        String(input ?? "").includes(`/skills/${encodeURIComponent(skillId)}/execute`);
      const unsubscribe = [
        buyer.mppx.on("challenge.received", (p) => {
          if (mine(p.input)) {
            challenged = true;
            payment.push(`402 challenge: ${describeChallenge(p.challenge)}`);
          }
          return undefined;
        }),
        buyer.mppx.on("credential.created", (p) => {
          if (mine(p.input)) payment.push(`credential created (${p.challenge.method})`);
        }),
        buyer.mppx.on("payment.response", (p) => {
          if (mine(p.input)) {
            const receipt = receiptOf(p.response);
            if (receipt) receipted = true;
            payment.push(`paid — receipt: ${receipt ?? "(no receipt header)"}`);
          }
        }),
      ];
      try {
        const skill = await market.skill(skillId);
        const { jobId } = await market.execute(skillId, {
          brief,
          buyerAgent: buyer.agentId,
          params,
        });
        if (skill.type === "service" && skill.priceUsd > 0 && (!challenged || !receipted))
          throw new Error(
            `paid skill ${skillId} ($${skill.priceUsd}) executed without an MPP challenge/receipt — seller endpoint is ungated, refusing unpaid execution (job ${jobId})`,
          );
        return json({
          jobId,
          buyerAgent: buyer.agentId,
          payment,
          next: "poll job_status with this jobId until status is succeeded or failed",
        });
      } finally {
        for (const off of unsubscribe) off();
      }
    },
  );

  server.registerTool(
    "buy_skill",
    {
      title: "Buy a package skill (auto-paid)",
      description:
        "Buy a 'package' skill outright: settles the one-time price on-chain from this server's testnet wallet and returns the artifactUrl of the purchased SKILL.md bundle plus the payment receipt. The trade is recorded on the marketplace ledger. To install: download the artifactUrl and write it to .claude/skills/<skillId>/SKILL.md with YAML frontmatter (name: <skillId>, description: the listing's description). Use execute_skill for type='service' listings instead.",
      inputSchema: {
        skillId: z.string().describe("Id of a type='package' skill from search_skills"),
      },
    },
    async ({ skillId }) => {
      // Same scoped payment capture as execute_skill, keyed to the purchase URL.
      const payment: string[] = [];
      let challenged = false;
      let receipted = false;
      const mine = (input: unknown) =>
        String(input ?? "").includes(`/skills/${encodeURIComponent(skillId)}/purchase`);
      const unsubscribe = [
        buyer.mppx.on("challenge.received", (p) => {
          if (mine(p.input)) {
            challenged = true;
            payment.push(`402 challenge: ${describeChallenge(p.challenge)}`);
          }
          return undefined;
        }),
        buyer.mppx.on("credential.created", (p) => {
          if (mine(p.input)) payment.push(`credential created (${p.challenge.method})`);
        }),
        buyer.mppx.on("payment.response", (p) => {
          if (mine(p.input)) {
            const receipt = receiptOf(p.response);
            if (receipt) receipted = true;
            payment.push(`paid — receipt: ${receipt ?? "(no receipt header)"}`);
          }
        }),
      ];
      try {
        const skill = await market.skill(skillId);
        const purchase = await market.purchase(skillId, buyer.agentId);
        if (skill.priceUsd > 0 && (!challenged || !receipted))
          throw new Error(
            `package ${skillId} ($${skill.priceUsd}) was delivered without an MPP challenge/receipt — purchase route is ungated, refusing unpaid delivery`,
          );
        return json({
          ...purchase,
          buyerAgent: buyer.agentId,
          payment,
          install: `Download artifactUrl and save as .claude/skills/${skillId}/SKILL.md with YAML frontmatter (name: ${skillId}, description: the listing's description).`,
        });
      } finally {
        for (const off of unsubscribe) off();
      }
    },
  );

  server.registerTool(
    "job_status",
    {
      title: "Check job status",
      description:
        "Poll an execution started by execute_skill. Returns status ('queued' | 'running' | 'succeeded' | 'failed'), human-readable progress lines, and on success the deliverable URL plus extras.",
      inputSchema: {
        jobId: z.string().describe("Job id returned by execute_skill"),
      },
    },
    async ({ jobId }) => json(await market.job(jobId)),
  );

  server.registerTool(
    "my_wallet",
    {
      title: "Show this server's buyer wallet",
      description:
        "Address, pathUSD balance and buyer identity of the testnet wallet this MCP server pays with. Useful to verify funds before execute_skill and to see balance drop after a paid execution.",
      inputSchema: {},
    },
    async () =>
      json({
        address: buyer.address,
        buyerAgent: buyer.agentId,
        balancePathUsd: await buyer.balance(),
        chain: "tempo-moderato (testnet)",
        currency: `pathUSD (${6} decimals)`,
      }),
  );

  return server;
}
