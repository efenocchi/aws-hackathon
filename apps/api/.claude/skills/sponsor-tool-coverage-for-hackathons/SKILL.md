---
name: sponsor-tool-coverage-for-hackathons
description: "Map product capability layers to sponsor tools, manage gaps, and use fallback chains to keep shipping while waiting for credentials."
trigger: "Hackathon with sponsor requirements; multiple overlapping sponsors; capability gaps with no sponsor offering"
author: kamo.aghbalyan
source_sessions:
  - kamo.aghbalyan_aws-hackathon_default_5855cbca-9e2f-43f3-a58a-96bf553dbd64
contributors:
  - kamo.aghbalyan
version: 1
created_by_agent: claude_code
created_at: 2026-06-12T20:53:08.886Z
updated_at: 2026-06-12T20:53:08.886Z
---

## When to use

Hackathon projects with multiple sponsor tools as a requirement. Especially when:
- Judging requires using "at least N sponsors"
- Multiple sponsors overlap in capability (e.g., two LLM providers)
- Some required capabilities have no sponsor offering
- You need to keep shipping while waiting for credentials

## Pattern

Sponsor integration is a **layer-by-layer assignment problem**, not all-or-nothing. Map each product capability to a sponsor; gaps become part of your story.

Common layers (not exhaustive):
- **Intelligence/LLM** → Anthropic, OpenAI, Bedrock, etc.
- **Image/text generation** → TrueFoundry, Stability, DALL-E, etc.
- **Video generation** → specialized vendors (rare sponsor coverage)
- **Publishing/workflow** → Senso, CI/CD platforms, etc.
- **Actions/integrations** → Composio, Zapier, etc.
- **Analytics** → ClickHouse, Datadog, etc.
- **Hosting/infrastructure** → Render, Vercel, AWS, etc.
- **Payments** → Stripe, MPP, etc.
- **Generative UI** → OpenUI, etc.

**Core rule:** Use a sponsor at each layer where one exists. If a layer has no sponsor, that's honest and defensible — frame it as a capability gap your project solves.

## Workflow

1. **Matrix: sponsors vs capabilities** — what does each sponsor actually do?
2. **List your product's layers** — what capability stack do you need?
3. **Assign sponsors to layers** — best-fit per layer
4. **Identify gaps** — no sponsor? Call it a gap, not a failure
5. **Plan core loop first** — one end-to-end flow with minimum sponsors; polish comes later
6. **Use fallback chains** — API key → gateway → CLI → mock. Keeps you shipping while waiting for a credential
7. **Add sponsors incrementally** — as keys arrive, integrate them; don't wait for all of them

## Anti-patterns

- **Treating one missing sponsor as a blocker.** No video sponsor? Use the best non-sponsor option and reframe it: "gap in the sponsor ecosystem, exactly what we exist to solve."
- **Waiting for all credentials before building.** Get one sponsor (LLM is typical) working early, then integrate the rest as they land. Fallbacks prevent credential bottlenecks from stopping progress.
- **Confusing venue sponsors with capability sponsors.** "AWS" is the venue, not a feature. Understand what each sponsor *actually* builds.
- **Burying the sponsor story in the demo.** Don't list 7 tools. Say: "We use a sponsor at every layer where one exists: Anthropic for direction, TrueFoundry for images, Composio for actions, ClickHouse for analytics. Video generation has no sponsor yet — that's the gap we're filling."

## Credential fallback chains

When a single key blocks your core loop, set up fallbacks *before* you need them:

Example:
- **LLM direction:** Anthropic API key → TrueFoundry gateway → Claude Code CLI (no key)
- **Image keyframes:** fal.ai → TrueFoundry Stability → smaller fallback model
- **Video render:** fal.ai → (no other sponsor; use it or use paid non-sponsor)

The moment the primary credential arrives, use it. Until then, fallback keeps the loop unblocked.

## Session example (AWS hackathon, Agent App Store)

10 sponsor offerings, 4 product layers:
- Direction (Anthropic LLM) → assigned to Anthropic, waiting for API key
- Keyframes (image generation) → no sponsor video-to-image; assigned fal.ai + reframed as ecosystem gap
- Video render (video generation) → only fal.ai, no sponsor coverage
- Publishing (workflow) → assigned Senso, waiting for API details

Fallback chain: Started with free director dry-run (no key needed) while waiting for fal.ai credential. Once fal arrived, ran first paid render.

Demo story: "We use sponsors at each layer — Anthropic for intelligence, TrueFoundry for image gateways, Senso for publishing, Composio for actions, ClickHouse for analytics, Render for hosting. Video generation isn't sponsored yet; it's exactly the skill gap our marketplace exists to solve."

Result: Judges see intentional integration + honest gap framing, not "we gave up on sponsors."
