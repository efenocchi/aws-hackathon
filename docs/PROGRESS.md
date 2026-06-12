# Progress Tracker

Updated after each iteration. Owners: K = Kamo, E = Emanuele.

_Last update: 2026-06-12 ~21:40 UTC_

## Build-order status (from PLAN.md)

| # | Step | Status |
|---|---|---|
| 1 | Contracts + scaffold (monorepo, schemas) | ✅ done, merged to main |
| 2a | Video pipeline happy path (K) | 🟡 code complete + director verified free via Claude Code CLI; **first paid render on hold** (user gate on Runware $40) |
| 2b | MPP seller+buyer happy path (E) | 🟡 built in E's clone (`packages/payments`, `mcp-server`, `broker`) — **unpushed**, his review found 2 blockers (unpaid-path fallthrough; wallet-key handling) |
| 3 | Catalog + UI + broker connect | 🟡 catalog (11 skills) + storefront UI ✅; broker is E's, not yet integrated |
| 4 | cited.md + Shipables + Composio + ClickHouse wiring | 🟡 all code ready, all waiting on keys/accounts |
| 5 | Hero pre-renders, dry run, demo rehearsal, Devpost | ⬜ blocked on render spend approval; Devpost draft ✅ |

## Sponsor coverage (goal: all 11)

| Sponsor | Code | Live | Notes |
|---|---|---|---|
| anthropic | ✅ | ✅ free via Claude Code CLI | API key in .env, **unused by policy** (free-first priority; DIRECTOR_PROVIDER=anthropic to opt in) |
| senso (cited.md+Shipables) | ✅ | ⬜ | needs SENSO_API_KEY + shipables publish |
| runware* / video | ✅ | ⬜ | AIR ids verified free; smoke ~$0.30 awaiting approval. *not a sponsor — covers the no-sponsor video layer |
| jua | ✅ | ⬜ | needs JUA_API_KEY |
| pioneer | ✅ | ⬜ | key in .env; first test call pending user OK |
| truefoundry | ✅ | ⬜ | needs key |
| composio | ✅ | ⬜ | needs key + Slack Connect Link |
| render | ✅ blueprint | ⬜ | `RENDER_API_KEY` in .env looks like a **promo code** (HTHON100-…), not an `rnd_` API key — redeem in dashboard, then create real API key |
| clickhouse | ✅ | ⬜ | needs cloud signup ($300 free) |
| openui | ✅ | ✅ validated | agent-designed deliverable views; parse chain green |
| guild-ai | ⬜ | ⬜ | needs account → publish agent to Agent Hub |
| airbyte | ⬜ | ⬜ | OAuth MCP — pairs with E's MCP server |

## Integration debt (the seam between K and E)

1. E's MPP middleware must gate `POST /skills/:id/execute` (mount point marked in `apps/api/src/index.ts`) — closes his DO-NOT-SHIP blocker #1.
2. Replace mock `recordTransaction` receipt with real MPP receipt → ClickHouse + leaderboard show real settlements.
3. E's broker/MCP should FAIL on ungated endpoints once gating lands (his blocker #2).
4. E to pull main (he was 8 commits behind at 21:02) and push payments packages.

## Spend log

| When | What | Cost |
|---|---|---|
| 21:33 | Runware modelSearch calls (id verification) | $0.00 (free endpoint) |
| all day | Director runs via Claude Code CLI | $0 API spend (subscription) |
| — | Runware/Anthropic/Pioneer paid calls | none — gated on user approval |
