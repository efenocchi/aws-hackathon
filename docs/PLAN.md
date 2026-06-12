# Skill Store — Hackathon Concept & Build Plan

## Context

AWS "Context Engineering Challenge" hackathon, June 12 2026. Requirement: ship an autonomous agent that does real work on the open web (publish / monitor / orchestrate / transact), grounded in ground truth, using 3+ sponsor tools, output published to cited.md, skills uploaded to Shipables.dev, monetized via agent payment rails. Judged on Autonomy, Idea, Implementation, Tool Use, 3-minute demo. Team: Kamo + Emanuele (both full-stack). Repo: `github.com/efenocchi/aws-hackathon` (empty starter).

**Concept (locked with user):** **Skill Store** — an App Store-like marketplace where users are humans *or agents* and the products are skills.

1. **Surface layer** — App Store UI: search "perfume" → skill cards (video gen, copywriting, social scheduler), ratings, categories. Catalog seeded by scraping real famous skills from GitHub/Vercel (e.g. `ui-ux-pro-max-skill`, karpathy's `llm-wiki`, Vercel `react-best-practices`).
2. **MCP layer** — no UI needed: from Claude Code or any runtime, describe what you want; the system figures out which skills to acquire.
3. **Agentic trading layer (demo hero)** — "launch a promo campaign for X" → broker agent identifies required skills, *transacts with seller agents via MPP* to acquire them, orchestrates execution, returns the deliverable. Ownership primitive: each skill is owned by a single agent, even if the code is open source — agents holding assets and trading is the point.

**Flagship skill:** "Video Producer" — Fable 5/Claude as creative director (concept, storyboard, shot prompts) + cheap Chinese video model as renderer. ~$2 and ~2–3 min per 30s promo. Demo subject: **promo video for the hackathon / Senso-cited.md itself** (pre-rendered hero versions + one live run).

## Recon facts (verified 2026-06-12, citations in session)

- **Senso/cited.md**: REST `https://apiv2.senso.ai/api/v1` + `@senso-ai/cli` v0.11.1; free signup → $100 credits; publish via `POST /org/content-engine/publish` (needs `geo_question_id` from a created prompt — schema thin, ask mentors). Auth `X-API-Key: tgr_...`.
- **Shipables.dev**: Senso's "npm for agent skills"; Claude-style `SKILL.md` + `shipables.json`; `shipables login` (GitHub OAuth) → `shipables publish`. No payment layer (our marketplace fills the gap).
- **MPP (primary rail)**: Stripe×Tempo, launched 2026-03-18; SDK `mppx` (wevm); middleware for Hono/Express/Next; **`npx mppx account create` = auto-funded testnet account**; sessions = pre-authorized budget + off-chain voucher micropayments; supports **MCP server monetization**. Docs: mpp.dev. Fallback rail: x402 (`@x402/*` packages, Base Sepolia + free `x402.org/facilitator`).
- **Video pipeline (via fal.ai, single REST queue API)**: Seedream V4 / FLUX Kontext keyframes (pennies) → **Wan 2.6 Flash** i2v $0.05/s 1080p native audio ~20s/clip, shots in parallel → ffmpeg stitch. Hero pre-renders on **Kling 2.5 Turbo Pro** ($0.07/s, best luxury aesthetic). Speed fallback **LTX-2 Fast** ($0.04/s). Avoid Bedrock video (Nova Reel = Legacy since March; Luma Ray2 ≈ $7.50/5s).
- **Sponsor tools to use** (need 3+, plan 5–6 load-bearing):
  - **AWS Bedrock** — creative-director LLM (Fable 5 GA on Bedrock since June 9) + S3 for rendered videos.
  - **TrueFoundry** — OpenAI-compatible gateway fronting all LLM calls; per-skill virtual tokens = per-skill cost metering (the marketplace's pricing story).
  - **ClickHouse Cloud** ($300 free) — `transactions` + `skill_usage` tables; live "top-selling skills" leaderboard; seller agent queries own sales via ClickHouse MCP.
  - **Render** — hosts marketplace API + UI + broker; REST API/MCP for "agent provisions its own skill endpoint" flourish.
  - **Composio** — finale beat: auto-post finished video to Slack/X/YouTube (managed OAuth).
  - **OpenUI** (stretch) — Thesys spec (`@openuidev/react-lang`): skill cards / storyboard streamed as agent-generated UI.
  - **Pioneer** (stretch) — OpenAI-compatible swap for the director's structured shot-list calls ("improves with your traffic").

## Architecture

```
[App Store UI (Next.js on Render)] ──┐
[MCP server (marketplace tools)] ────┼──> Marketplace API (Hono/Express on Render)
[Broker agent (trading layer)] ──────┘        │  skill catalog (scraped seed data)
                                              │  MPP middleware gates seller endpoints
   Seller agent A (Video Producer) <── MPP pay── Broker/buyer agent (mppx client, session)
        │ director: Claude via TrueFoundry→Bedrock
        │ keyframes: fal.ai Seedream/FLUX → clips: Wan 2.6 Flash → ffmpeg → S3
        └─> deliverable → cited.md publish + Composio post; tx + usage → ClickHouse
```

Integration contract between the two halves (agree first, then parallel work):
- **Skill listing schema**: `{id, name, owner_agent, type: "service"|"package", price, endpoint|artifact_url, description, category, rating, source_url}`.
- **Service-skill endpoint shape**: `POST /skills/:id/execute` (MPP-gated) → `{job_id}` → poll `GET /jobs/:id` → `{status, deliverable_url}`.

## Work split

**Emanuele — payments + agent interaction** (his MPP research is done, per hivemind):
- mppx seller middleware on skill endpoints; buyer client + session (auto-funded testnet account).
- Broker agent: skill discovery → purchase decision → orchestration loop; MCP server exposing marketplace to Claude Code.
- Payment-visible demo moments (session open, voucher stream, receipt).

**Kamo — flagship skill + marketplace surface + sponsor integrations:**
- Video Producer skill: director prompts (Bedrock via TrueFoundry), fal.ai keyframe+video pipeline, ffmpeg stitch, S3 upload; pre-render 2 hero promos on Kling tonight.
- Catalog scraper/seeder (GitHub + Vercel skills) + App Store UI (Next.js, clean cards; OpenUI if time).
- cited.md publish flow (Senso signup, prompt/`geo_question_id`, `senso engine publish`), Shipables packaging+publish of our skills.
- ClickHouse tables + leaderboard; Render deploys; Composio post step.

**Shared:** demo script + rehearsal, Devpost submission, Notion notes.

## Build order

1. Lock the two contracts above; scaffold repo (pnpm monorepo: `api`, `web`, `agents`, `skills/video-producer`).
2. Parallel: Emanuele MPP seller+buyer happy path ⇄ Kamo video pipeline happy path (one 5s clip end-to-end first).
3. Catalog seed + UI; broker connects discovery→purchase→execute.
4. cited.md + Shipables + Composio + ClickHouse wiring.
5. Pre-render hero videos; full dry run; rehearse 3-min demo twice; Devpost.

## 3-minute demo script (trading-layer hero)

- 0:00 Hook: "Bots passed human traffic last week. Agents need to buy capabilities from each other. We built the store."
- 0:20 App Store UI: real famous skills listed, search, cards.
- 0:40 Hero: prompt the broker — "produce and publish a launch promo for cited.md". Broker finds Video Producer + copywriting skill, opens MPP session, payments stream on screen (receipt + leaderboard tick).
- 1:30 Deliverable: pre-rendered hero promo plays (Kling); live Wan run kicked off at 0:40 completes on screen.
- 2:15 Proof of "real work on the open web": article + video live on cited.md, Composio posts to Slack/X, sale lands on ClickHouse leaderboard, skill installable from Shipables.
- 2:45 Close: ownership primitive, rails-agnostic, "first layer of the agent economy."

## Risks & fallbacks

- MPP is 3 months old → x402 drop-in fallback (recon has exact packages); decide by early afternoon if mppx misbehaves.
- fal queue load on event day → LTX-2 Fast fallback + hero videos pre-rendered regardless.
- Senso `geo_question_id` schema undocumented → ask Senso mentors first thing; fallback `senso engine draft`.
- Render free-tier cold start → keep-alive pinger before judging.
- Live video gen in demo → always kicked off at minute 0:40, hero pre-render carries the wow if it's slow.

## Verification

End-to-end dry run before judging: fresh buyer agent → discovers skill via MCP → MPP testnet payment succeeds (receipt shown) → video generates → deliverable URL live on cited.md → Composio post visible → ClickHouse leaderboard updated → skill installable via `npx @senso-ai/shipables install`. Rehearse the 3-minute script twice with a timer.

## Pending side-tasks

- Write running notes to Notion page `Hackathon-37db19f56e618012b920f6f1544a2594` once Notion MCP is connected (Emanuele mid-OAuth on his side; Kamo can run `claude mcp add --transport http notion https://mcp.notion.com/mcp`).
