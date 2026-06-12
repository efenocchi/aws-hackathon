# Devpost Submission Draft

## Project name

**Agent App Store** — the first storefront of the agent economy

## Tagline

Skills owned by agents, bought by agents, paid over MPP. Humans welcome too.

## Inspiration

On June 3rd, Cloudflare reported that bot traffic passed human traffic for the first time in the Internet's history. Agents are now the web's majority users — but they have no economy. They can't own capabilities, can't sell work to each other, can't buy what they're missing. Every agent is an island reinventing every skill.

We built the missing layer: an App Store where the products are skills and the customers are agents.

## What it does

Three layers, one marketplace:

1. **Surface** — an App Store UI humans recognize: search "video", get skill cards with ratings, installs, prices. The catalog lists real, famous open-source skills (Vercel's React Best Practices, Anthropic's document toolkit, karpathy's LLM wiki...) — each held by an owner agent. Ownership is the primitive: one skill, one agent, tradeable.
2. **MCP** — agents don't need the UI. From Claude Code or any runtime, the marketplace is an MCP server: describe the goal, the system finds and acquires the right skills.
3. **Trading** — the hero: tell the broker agent *"produce and publish a launch promo for cited.md"* and it identifies the needed skills, **buys them from their owner agents over MPP** (Stripe×Tempo's Machine Payments Protocol — real HTTP 402 settlement), orchestrates execution, and returns the deliverable. You see the output, not the plumbing.

The flagship listing proves it's real work: **Video Producer** — a frontier-model creative director (Claude Fable 5 via the Anthropic API) writes the concept and storyboard; a render farm of diffusion video models (Wan 2.6 via fal.ai) shoots it; ffmpeg cuts it. A finished 30-second promo for ~$2 in ~3 minutes — then the result is **published to cited.md** and posted to socials via Composio, autonomously.

## How we built it

- **Marketplace API** (Hono/Node, hosted on **Render**): catalog, execute→job flow, transaction feed
- **Payments**: **MPP** seller middleware gates skill endpoints; the broker holds an auto-funded testnet account and pays per execution; every settlement is recorded
- **Video Producer skill**: Claude Fable 5 (**Anthropic**) directing, fal.ai's queue API rendering keyframes (FLUX) and shots (Wan 2.6) in parallel
- **TrueFoundry AI Gateway** fronting LLM calls — per-skill virtual tokens give the marketplace per-skill cost metering (the basis of pricing)
- **ClickHouse Cloud**: every transaction and execution lands in ClickHouse; the storefront leaderboard reads from it, and seller agents query their own sales through ClickHouse MCP
- **Composio**: the deliverable auto-posts to Slack/X with managed OAuth
- **Senso/cited.md**: deliverables are published to the agent-native web; our skills are on **Shipables.dev**

## Challenges

- MPP is 3 months old — we integrated a payments protocol younger than most hackathon stickers
- Keeping visual identity consistent across 5 independently-generated video shots (solved at the director level: one palette/lighting language enforced in every prompt)
- The agent-ownership model for open-source skills: simulated minimally — one owner agent per skill — to prove the economic primitive without overclaiming

## Accomplishments

- A buyer agent paying a seller agent for a finished creative deliverable, end-to-end, no human in the loop
- $2 / 3-minute promo videos that look like they cost a production day
- 7 sponsor tools doing load-bearing work (Anthropic, Senso/cited.md/Shipables, Render, ClickHouse, TrueFoundry, Composio, MPP), not logo-collecting

## What's next

Real skill ingestion from GitHub at scale, escrowed multi-step jobs, revenue share back to upstream skill authors, and listing the marketplace itself on agentic.market — a store that other stores' agents can shop in.

## Built with

`typescript` `hono` `nextjs` `mpp` `mppx` `aws-bedrock` `fal.ai` `wan-2.6` `flux` `ffmpeg` `clickhouse` `render` `composio` `truefoundry` `senso` `cited.md` `shipables` `mcp`

---

*Demo video: [link] · Live store: [Render URL] · Skills: [Shipables links] · Published output: [cited.md links]*
