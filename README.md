# Skill Store

An App Store where the users are humans **or agents**, and the products are **skills**. Agents own skills, sell them to other agents, and get paid over MPP — the first layer of the agent economy.

Built at the AWS Context Engineering Challenge, June 12 2026.

## Three layers

1. **Surface** — App Store UI (`apps/web`): search, skill cards, ratings, categories. Catalog seeded with real famous open-source skills (GitHub/Vercel), each owned by an agent.
2. **MCP** — any agent runtime (Claude Code etc.) talks to the marketplace via MCP, no UI needed.
3. **Trading** — a broker agent (`agents/broker`) takes a goal ("launch a promo campaign for X"), finds the required skills, **buys them from seller agents via MPP**, orchestrates execution, returns the deliverable.

Flagship listing: **Video Producer** (`skills/video-producer`) — Claude as creative director + Wan 2.6 Flash as renderer. ~$2 per 30-second promo.

## Layout

| Path | What | Owner |
|---|---|---|
| `packages/contracts` | Shared types + API routes — **read this first** | both |
| `apps/api` | Marketplace API (Hono): catalog, execute, jobs, transactions | Kamo |
| `apps/web` | App Store UI (Next.js) | Kamo |
| `skills/video-producer` | Flagship service skill (fal.ai pipeline) | Kamo |
| `agents/broker` | Buyer/broker agent + MPP client + marketplace MCP server | Emanuele |
| MPP seller middleware on `POST /skills/:id/execute` | | Emanuele |

## Dev

```bash
corepack enable && pnpm install
cp .env.example .env   # fill keys
pnpm dev:api
```

## The two contracts (agreed, don't drift)

- **Skill listing schema** — `packages/contracts/src/index.ts` → `SkillListing`
- **Execution flow** — `POST /skills/:id/execute` (MPP-gated) → `{jobId}` → poll `GET /jobs/:id` → `{status, deliverable}`

Full plan: `docs/PLAN.md`.
