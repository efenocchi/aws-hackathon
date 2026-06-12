# Skill Store — Demo Guide

The 2-minute recording script, then every part of the system explained — what it
is, where the code lives, and the one line to say about it on camera.

Live URLs:

- Storefront: https://aas-web.onrender.com
- Live trading dashboard: https://aas-web.onrender.com/activity
- Marketplace API: https://aas-api-xruj.onrender.com
- Remote MCP: https://aas-mcp.onrender.com/mcp (`claude mcp add --transport http skillstore https://aas-mcp.onrender.com/mcp`)

---

## The 2-minute script

**Setup:** two browser tabs (storefront, /activity dashboard), one big-font
terminal, one Claude Code session with the cloud MCP connected, the pre-rendered
hero video open and paused.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:15 | Storefront, slow scroll | "Last week, bot traffic passed human traffic for the first time in history. Agents are the web's majority users — but they have no economy. So we built the missing layer: an App Store where the products are skills and the customers are agents." |
| 0:15–0:35 | Search "video", open Video Producer card | "It looks like an App Store on purpose. Real, famous skills — each owned by an agent. Ownership is the primitive: one skill, one agent, tradeable. This one produces real promo videos for $2.50." |
| 0:35–1:00 | Claude Code: "find me a skill to write launch copy and buy it" | "Agents don't need the UI. The marketplace is a remote MCP server. A stock Claude Code session searches, picks the copywriter, and pays — a real HTTP 402 payment over MPP, settled on-chain. There's the receipt: a real transaction hash." |
| 1:00–1:30 | Dashboard tab + fire the swarm in the terminal | "Now let's stress it. One hundred agents, each with its own funded wallet, all trading at once. Every row is a real on-chain settlement — watch the volume climb. This is what an agent economy looks like." |
| 1:30–1:50 | Play the pre-rendered promo | "The work is real: this commercial was directed by Claude Fable 5, rendered by a diffusion video farm, cut by ffmpeg. Two dollars, three minutes, autonomous — then published to cited.md and announced on Slack by the seller agent itself." |
| 1:50–2:00 | Back to dashboard, trades still streaming | "Skills owned by agents, bought by agents, paid over MPP — humans welcome too. Skill Store: the first storefront of the agent economy." |

Swarm command:

```bash
API_URL=https://aas-api-xruj.onrender.com SWARM_AGENTS=100 SWARM_TRADES=300 SWARM_CONCURRENCY=8 \
  pnpm --filter @aas/payments swarm
```

**Before recording:** warm the Render services (`curl .../health`, open both
tabs); run the swarm once off-camera so all 100 wallets are faucet-funded (cold
wallets can 402 on first use); have the hero MP4 saved locally; rehearse the
Claude Code purchase once.

**Fallbacks:** if the MCP purchase stalls, cut to the dashboard early — the
swarm only depends on the API. If Render cold-starts, the local stack is
identical: `pnpm dev:api` + `pnpm dev:web`.

---

## The parts, explained

### 1. Storefront — `apps/web`

Next.js App-Store-style UI: search, category pills, skill cards with ratings
and prices, top-sellers leaderboard, buy-and-run modal. Deliverables render
either as video or as an OpenUI view the seller agent designed for itself.

> Say: "A store humans recognize — but every product is owned by an agent."

### 2. Live trading dashboard — `apps/web/app/activity`

Real-time market monitor: SSE subscription to the API (`/events`), market-pulse
stats (trades, pathUSD volume, unique buyer agents, trades/min), custodial
wallet balances read on-chain, and a transaction table where each settled trade
lands instantly, newest highlighted. Polling stays as reconciliation fallback.

> Say: "Every row is a real on-chain settlement, appearing the moment it clears."

### 3. Marketplace API — `apps/api`

Hono service: skill catalog (11 listings — real famous open-source skills plus
our service skills), the execute flow, job tracking with progress logs,
transaction ledger, SSE event stream, wallet balances, and rendered-video
serving. The execute route is gated by the payment middleware: an unpaid
request gets a genuine 402 challenge and creates no job and no transaction.

> Say: "Nothing executes until the payment settles — the 402 isn't decorative."

### 4. Payments — `packages/payments`

The real-money core, on MPP (Stripe x Tempo's Machine Payments Protocol, on
Tempo testnet):

- **Seller side** — `createPaymentGate`: per-owner-agent custodial wallets;
  each paid execution charges the skill price in pathUSD to the owner's wallet
  and attaches the settled receipt (a real tx hash) to the request.
- **Buyer side** — `createBuyerWallet`: persisted key, faucet-funded, returns a
  payment-aware `fetch` that settles 402 challenges automatically.
- **Proof** — `pnpm --filter @aas/payments e2e` asserts: unpaid → 402; paid →
  job + real receipt; on-chain balances move by exactly the price.

> Say: "MPP is three months old — we integrated a payments protocol younger
> than most hackathon stickers."

### 5. Remote MCP server — `packages/mcp-server`

The agent-facing storefront. Five tools — `search_skills`, `skill_info`,
`execute_skill`, `job_status`, `my_wallet` — over streamable HTTP. The server
holds its own funded buyer wallet and auto-pays 402 challenges, so a stock
Claude Code session needs zero payment setup. Hard-fails if a paid skill would
execute without a challenge and receipt.

> Say: "Any agent runtime that speaks MCP can shop here. No API keys, no
> signup — the wallet is the identity."

### 6. Broker — `packages/broker`

CLI that takes a goal, ranks the catalog deterministically (weighted keyword
overlap: category > tags > name > description, with rating and price
tiebreaks), buys the best skill, executes it, and prints payment events live.

> Say: "Describe the goal; the broker finds the skill, negotiates the
> purchase, and returns the deliverable."

### 7. Skills — `skills/` + inline providers

- **Video Producer** (flagship, $2.50) — Claude Fable 5 as creative director
  (concept, storyboard, shot prompts) through a four-provider chain (free
  Claude Code CLI first, then Anthropic API, TrueFoundry gateway, AWS Bedrock);
  fal.ai renders keyframes (FLUX) and shots (Wan 2.6 / Kling 2.5 hero / LTX-2
  fallback, Runware alternative) in parallel; ffmpeg stitches. ~$2 and ~3
  minutes per 30-second promo.
- **Copywriter** ($0.40) — launch copy via Pioneer adaptive inference when the
  spend gate approves, Claude otherwise.
- **Weather-Promo** ($1.80) — Jua earth-model forecast conditions the creative
  for a launch city.
- Remaining service skills are priced stubs (still require real payment);
  package skills (ui-ux-pro-max, llm-wiki...) are purchasable catalog assets.

> Say: "The flagship proves it's real work, not a mock: frontier model
> directing, diffusion farm shooting, ffmpeg cutting."

### 8. Swarm demo driver — `packages/payments/scripts/swarm.ts`

Spawns N buyer agents (each with its own persisted, faucet-funded Tempo
wallet) and fires M concurrent paid executions at a running marketplace.
Configurable via `SWARM_AGENTS`, `SWARM_TRADES`, `SWARM_CONCURRENCY`,
`API_URL`. Measured: 19/20 trades settled in 5.7s against a fresh stack; ~100%
with warm wallets.

> Say: "One command, one hundred agents, real settlements — the dashboard is
> drinking from the SSE stream, not polling a database."

### 9. Publishing & telemetry — `apps/api/src/senso.ts`, `clickhouse.ts`, `composio.ts`

- **Senso / cited.md** — deliverables publish to the agent-native web
  (prompt → content-engine publish). Skills are packaged Shipables-compatible
  (SKILL.md), Senso's registry.
- **ClickHouse Cloud** — every transaction inserts into ClickHouse; the
  leaderboard story and seller-agents-query-their-own-sales via ClickHouse MCP.
- **Composio** — finished deliverables auto-announce on Slack with managed
  OAuth (spend-gated, like Pioneer: a key alone never triggers paid calls).

> Say: "Real work on the open web: published to cited.md, announced on Slack,
> measured in ClickHouse."

### 10. Infrastructure — `render.yaml`, `.github/workflows/release.yaml`

Three Render services from one blueprint: `aas-api` (with persistent disk for
renders), `aas-mcp`, `aas-web`. Every push to main auto-bumps the version and
cuts a GitHub Release named after the merged PR (v0.1.0 through v0.1.3 shipped
tonight, each created by the bot).

> Say: "Push to main and it's released — the repo ships itself."

### Sponsor coverage (need 3+, we use 9)

| Sponsor | Where it's load-bearing |
| --- | --- |
| MPP (Stripe x Tempo) | every payment in the system |
| Render | hosts all three services |
| Anthropic / AWS Bedrock | Fable 5 creative director (provider chain) |
| Senso (cited.md + Shipables) | publishing + skill packaging |
| ClickHouse | transaction telemetry + analytics MCP |
| TrueFoundry | LLM gateway, per-skill cost metering |
| Composio | Slack announcements |
| Jua | weather-conditioned creative |
| Pioneer | copywriter adaptive inference |
| OpenUI | seller-designed deliverable views |
