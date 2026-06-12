/**
 * Composio (sponsor) — managed-auth action layer. After a deliverable is
 * produced, the seller agent announces it on Slack (real action on the open
 * web, the demo's closing beat). No-ops without COMPOSIO_API_KEY.
 * Requires a Slack connected account on the Composio dashboard (Connect Link).
 */
import { Composio } from "@composio/core";

export function composioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

export async function announceDeliverable(opts: {
  skillName: string;
  buyerAgent: string;
  tagline?: string;
  videoUrl: string;
}): Promise<string> {
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  const session = await composio.create(process.env.COMPOSIO_USER_ID ?? "agent-app-store");
  const message = [
    `🎬 New deliverable from the Agent App Store`,
    `Skill: ${opts.skillName} · bought by ${opts.buyerAgent}`,
    opts.tagline ? `“${opts.tagline}”` : null,
    `Watch: ${opts.videoUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const result = await session.executeAction({
    toolName: "SLACK_SEND_MESSAGE",
    params: {
      channel: process.env.COMPOSIO_SLACK_CHANNEL ?? "#general",
      message,
    },
  });
  return JSON.stringify(result).slice(0, 300);
}
