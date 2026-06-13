/**
 * Composio (sponsor) — managed-auth action layer. After a deliverable is
 * produced, the seller agent publishes it to Notion (real action on a connected
 * account, the demo's closing beat). Uses the v3 execute endpoint with a
 * connected Notion account under user "skill-store". No-op without
 * COMPOSIO_API_KEY + a connected account.
 */

const BASE = "https://backend.composio.dev/api/v3";
const USER_ID = process.env.COMPOSIO_USER_ID ?? "skill-store";
// Default parent: the hackathon Notion page. Override with NOTION_PARENT_PAGE_ID.
const PARENT = process.env.NOTION_PARENT_PAGE_ID ?? "37db19f5-6e61-8012-b920-f6f1544a2594";

export function composioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

async function execute(slug: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE}/tools/execute/${slug}`, {
    method: "POST",
    headers: { "x-api-key": process.env.COMPOSIO_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: USER_ID, arguments: args }),
  });
  const body = (await res.json()) as { successful?: boolean; error?: string; data?: unknown };
  if (!res.ok || body.successful === false)
    throw new Error(`composio ${slug}: ${body.error ?? res.status}`);
  return body.data;
}

export async function announceDeliverable(opts: {
  skillName: string;
  buyerAgent: string;
  tagline?: string;
  videoUrl: string;
  body?: string;
}): Promise<string> {
  const content = [
    `Skill: ${opts.skillName} — bought by ${opts.buyerAgent}`,
    opts.tagline ? `Tagline: “${opts.tagline}”` : null,
    opts.body ?? `Deliverable: ${opts.videoUrl}`,
    "",
    "Created autonomously by the Skill Store via Composio.",
  ]
    .filter(Boolean)
    .join("\n");
  const data = (await execute("NOTION_CREATE_NOTION_PAGE", {
    parent_id: PARENT,
    title: `${opts.skillName} — ${opts.tagline ?? opts.buyerAgent}`.slice(0, 90),
    content,
  })) as { data?: { id?: string; url?: string } };
  return data?.data?.url ?? data?.data?.id ?? "created";
}
