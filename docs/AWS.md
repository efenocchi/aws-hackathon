# AWS / Bedrock setup

The paid-skill "director" step calls Claude on Bedrock
(`skills/video-producer/src/director.ts`, model + region from `src/config.ts:23-24`).

## Credentials (this box)

Only interactive SSO exists. The static `[default]` key in `~/.aws/credentials`
is dead (`InvalidClientTokenId`) and every SSO cache token is expired. To fix:

```bash
aws sso login --profile activeloop-dev-PowerUserAccess
```

Then run anything Bedrock-flavored with:

```bash
export AWS_PROFILE=activeloop-dev-PowerUserAccess
export AWS_REGION=us-west-2
```

(The profile pins `region = us-east-1`; the skill expects `us-west-2`, so set
`AWS_REGION` explicitly. SSO account: 574987031486, role: PowerUserAccess.)

## Model (run after login: `pnpm --filter @aas/video-producer smoke -- --dry`)

- Current default: `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (config.ts:23) — keep until verified.
- Claude Fable 5 went GA on Bedrock 2026-06-09. Global inference profile:
  `global.anthropic.claude-fable-5`. After login, confirm account access:

```bash
aws bedrock list-inference-profiles --region us-west-2 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId,'anthropic')].inferenceProfileId"
```

If `global.anthropic.claude-fable-5` is listed, set `BEDROCK_MODEL_ID` to it
(env-only, no code change), then re-run the dry smoke above — it costs nothing on fal.
