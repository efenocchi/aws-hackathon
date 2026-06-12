# Director providers — no AWS required

AWS is NOT a hackathon sponsor and no AWS credits exist. The video-producer
"director" step does not need it: provider selection lives in
`skills/video-producer/src/director.ts:48-53` and tries, in order:

1. **Anthropic API** (sponsor) — used when `ANTHROPIC_API_KEY` is set.
   Model: `ANTHROPIC_MODEL`, default `claude-fable-5` (director.ts:84).
2. **TrueFoundry gateway** (sponsor) — used when `TRUEFOUNDRY_API_KEY` is set
   (`TRUEFOUNDRY_BASE_URL`, `TRUEFOUNDRY_MODEL` in config.ts:27-29).
3. **Claude Code CLI** (`claude -p`, logged-in account, **no key needed**) —
   the local demo default. Used whenever the `claude` binary is on PATH and
   neither key above is set.
4. Bedrock — dead code in practice; only reached if no key is set AND the
   `claude` CLI is missing. Safe to ignore.

## Demo default (zero keys, zero spend)

```bash
unset ANTHROPIC_API_KEY TRUEFOUNDRY_API_KEY
pnpm --filter @aas/video-producer smoke -- --dry   # director only, no fal calls
```

Verified working on this box (claude CLI 2.1.170): returns a full storyboard JSON.

## Optional: Anthropic API via sponsor credits

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # takes priority over the CLI
```

## Storage

No S3 anywhere in the live path. Renders are written to `RENDERS_DIR`
(config.ts:36) and served from local disk by `apps/api/src/index.ts:106-114`.
On Render, a persistent disk is mounted at `/var/data/renders` (render.yaml).
