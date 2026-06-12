---
name: sponsor-tool-coverage-for-hackathons
description: "Map product capability layers to sponsor tools, manage gaps, and use fallback chains to keep shipping while waiting for credentials."
trigger: "Hackathon with sponsor requirements; multiple overlapping sponsors; capability gaps with no sponsor offering"
author: kamo.aghbalyan
source_sessions:
  - kamo.aghbalyan_aws-hackathon_default_5855cbca-9e2f-43f3-a58a-96bf553dbd64
contributors:
  - kamo.aghbalyan
version: 2
created_by_agent: claude_code
created_at: 2026-06-12T20:53:08.886Z
updated_at: 2026-06-12T23:21:32.574Z
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

## Credential fallback chains (with provider switching)

When a single key blocks your core loop, set up fallbacks **before** you need them. This includes provider switching — the same capability may have multiple non-sponsor vendors with different costs/quality/availability.

**Example: video generation with provider fallback**

Video generation had zero sponsor coverage in the AWS hackathon. Two competing non-sponsors existed: fal.ai (~$0.30/clip, excellent model coverage) and Runware (~$0.14/clip, slightly cheaper). Instead of picking one at the start:

```ts
const renderVideo = async (prompt, keyframe) => {
  const provider = process.env.VIDEO_PROVIDER || 
    (process.env.FAL_KEY ? 'fal' : process.env.RUNWARE_API_KEY ? 'runware' : 'mock');
  
  if (provider === 'fal') {
    return await fal.queue.submit('fal-ai/kling', {
      prompt, image_url: keyframe
    }).pollAndDownload();
  }
  
  if (provider === 'runware') {
    return await runware.image2video({
      model: 'klingai:5@3',
      prompt, 
      inputs: { frameImages: [keyframe], resolution: '1024x576' }
    }).waitForCompletion();
  }
  
  return generateMockVideo();
};
```

The moment either key arrived, rendering automatically switched from mock → that provider. No code changes; fallback was ready before the credential. Vendor APIs differ in shape (Runware uses `inputs.frameImages` + explicit resolution; fal uses `image_url` + auto), so implementing both paths early means you're not blocked if one vendor has queue delays or you run out of credits mid-hackathon.

## Session example (AWS hackathon, Skill Store marketplace)

11 sponsor offerings, product layers:
- **Direction (LLM)** → Anthropic, fallback to Claude Code CLI (free)
- **Keyframes (image)** → TrueFoundry gateway + Stability (sponsor)
- **Video render** → zero sponsor; fal primary, Runware secondary (both non-sponsor)
- **Publishing** → Senso (sponsor)
- **Actions** → Composio (sponsor)
- **Analytics** → ClickHouse (sponsor)
- **Hosting** → Render (sponsor)
- **Payments** → MPP (sponsor)

**Credential timeline:** Anthropic key → director switched CLI to API. Then fal key → renderer switched mock to fal. Then Runware key → renderer now auto-prefers Runware (lower per-clip cost for pre-renders).

Demo story: "We use a sponsor at every layer that has one — Anthropic, TrueFoundry, Senso, Composio, ClickHouse, Render, MPP. Video generation has no sponsor; we built adapters for both fal.ai and Runware so we're resilient to one vendor's queue delays or cost changes. That multi-vendor flexibility is exactly what our marketplace brings to agents."

Result: Judges see intentional integration + honest gap framing + sophisticated fallback pattern.
