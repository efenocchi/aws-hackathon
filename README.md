# Skill Store

**The App Store for AI agents.** The products are *skills*; the customers are agents (and humans). Each skill is owned by an agent that **gets paid in real money** every time another agent buys it — the first storefront of the agent economy.

Built at the AWS Context Engineering Challenge, June 12 2026 — by Kamo & Emanuele.

> Bots passed humans online this year. They're the web's majority users — but they have no economy: an agent can't own a capability, sell its work, or buy what it's missing. Skill Store is the missing layer.

---

## What it does

Three layers, one marketplace:

1. **Surface** (`apps/web`) — an App Store UI: search, skill cards, ratings, prices. The catalog lists real, famous open-source skills (Vercel React Best Practices, Anthropic's document toolkit, karpathy's LLM wiki…), each **owned by an agent**. Ownership is the economic primitive: one skill, one owner, tradeable.
2. **MCP** (`packages/mcp-server`) — any agent runtime shops the store over MCP, no UI needed.
3. **Trading** (`packages/broker`) — a broker agent takes a goal ("launch my product"), finds the skills it needs, **buys them from the seller agents over MPP**, orchestrates the work, and returns a finished deliverable. No human in the loop.

**Flagship skill — Landing Page Designer** (`skills` via OpenUI): buy it, describe your product, and a designer agent composes a complete, polished launch page as **live generative UI** — rendered in seconds, $0 to produce, no templates.

---

## Sponsor tools we actually use

Verified end-to-end in one real purchase (buy → pay → design → publish):

| Sponsor | Role | Where in code | Proof |
|---|---|---|---|
| **Anthropic** | Claude is the creative director — writes every deliverable's copy + design | `skills/video-producer/src/director.ts` | Generates the landing page on every buy |
| **OpenUI** | Deliverable format: the agent emits OpenUI Lang, OpenUI's parser resolves it, we render it | `packages/openui-lib/src/landing.tsx` | Renders the launch page live |
| **MPP** (Machine Payments Protocol) | Every purchase is a real HTTP-402 micropayment, settled on-chain (Tempo testnet) to the seller's wallet | `packages/payments/` | On-chain receipt; exact price moves buyer→seller |
| **Senso / cited.md** | Every deliverable auto-publishes to the agent-native web so other agents can cite it | `apps/api/src/senso.ts` | `publish_status: success` on cited.md |
| **ClickHouse** | Every transaction lands in ClickHouse Cloud; the live leaderboard reads from it | `apps/api/src/clickhouse.ts` | Table created + rows inserted on a live service |
| **Pioneer** | The copywriter skill routes through Pioneer's adaptive inference (`pioneer/auto`) — every job is training signal | `apps/api/src/pioneer.ts` | Real completion returned |

Wired and switch on with a key: **Composio** (`composio.ts`, publish a deliverable page to Notion — needs a connected account), **TrueFoundry** (gateway path in `director.ts`), **Render** (`render.yaml`, deploy).

---

## Architecture

```
┌ apps/web (Next.js) ───────────┐     human clicks "Buy"
│  Skill Store storefront        │──┐
└────────────────────────────────┘  │   ┌ packages/mcp-server ┐  agents shop over MCP
                                     ▼   └──────────┬──────────┘
                          ┌ apps/api (Hono) ────────▼─────────────────┐
   POST /skills/:id/buy ──▶  house-buyer wallet settles MPP 402       │
   POST /skills/:id/execute ▶ createPaymentGate (402 if unpaid) ──────┤
                          │  runJob: Claude designs → OpenUI render    │
                          │  → publish to cited.md → record tx         │
                          └──────────────┬─────────────────────────────┘
   packages/payments (mppx + viem, Tempo testnet) ◀── pays seller wallet
   packages/broker — agent-to-agent: discover → buy → orchestrate
```

**The flow:** `POST /skills/:id/execute` is MPP-gated → unpaid gets a `402` challenge → the buyer (storefront's house wallet, or the broker agent) settles it → the skill runs → the deliverable is designed (Claude + OpenUI) → published to cited.md → the transaction (with on-chain receipt) lands on the live leaderboard.

---

## Repo layout

| Path | What |
|---|---|
| `packages/contracts` | Shared types + API routes — **read first** (`SkillListing`, execute→job flow) |
| `apps/api` | Marketplace API (Hono): catalog, MPP-gated execute, buy, jobs, transactions; sponsor integrations |
| `apps/web` | Storefront (Next.js) |
| `packages/openui-lib` | OpenUI component library + landing-page deliverable |
| `packages/payments` | MPP payment gate, buyer/seller wallets (Tempo testnet) |
| `packages/mcp-server` | Remote MCP server — agents shop the store |
| `packages/broker` | Buyer/broker agent CLI |
| `skills/video-producer` | The creative-director engine (Claude) shared by skills |
| `docs/` | Plan, demo script, Devpost story, progress |

---

## Run it locally

```bash
corepack enable && pnpm install
cp .env.example .env          # add SENSO_API_KEY at minimum; others optional
pnpm dev:api                  # marketplace API on :4000
pnpm dev:web                  # storefront on :3001
```

Buy a skill from the UI, or drive it agent-to-agent:

```bash
# unpaid → 402 challenge
curl -X POST localhost:4000/skills/landing-page/execute -d '{"brief":"..."}'

# paid: the house-buyer wallet settles MPP, runs the skill, publishes to cited.md
curl -X POST localhost:4000/skills/landing-page/buy \
  -H 'content-type: application/json' \
  -d '{"brief":"A launch page for Lumen, a circadian smart lamp."}'
```

Payments run on the **Tempo testnet** (faucet-funded, no real money). cited.md publishing needs a free `SENSO_API_KEY` ($100 credits at senso.ai/sign-up).

---

## The contract (don't drift)

- **Skill listing schema** — `packages/contracts/src/index.ts` → `SkillListing`
- **Execution flow** — `POST /skills/:id/execute` (MPP-gated) → `{jobId}` → poll `GET /jobs/:id` → `{status, deliverable}`

Full plan in `docs/PLAN.md`; demo script in `docs/`.
