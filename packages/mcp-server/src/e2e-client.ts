/**
 * End-to-end check with the standard MCP SDK client over Streamable HTTP:
 * connect -> list tools -> search -> skill_info -> my_wallet -> execute ->
 * poll job_status to a terminal state. Run with the API and MCP server up:
 *   pnpm --filter @aas/mcp-server e2e
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "http://localhost:4500/mcp";
const SKILL_ID = process.env.SKILL_ID ?? "social-scheduler";

const client = new Client({ name: "e2e-check", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
console.log(`connected to ${MCP_URL}`);

const { tools } = await client.listTools();
console.log(`tools (${tools.length}):`, tools.map((t) => t.name).join(", "));

function text(result: Awaited<ReturnType<typeof client.callTool>>): string {
  const block = (result.content as Array<{ type: string; text?: string }>).find(
    (c) => c.type === "text",
  );
  if (!block?.text) throw new Error(`no text content: ${JSON.stringify(result)}`);
  return block.text;
}

const search = await client.callTool({
  name: "search_skills",
  arguments: { query: "launch" },
});
const found = JSON.parse(text(search)) as Array<{ id: string; name: string }>;
console.log(
  `search_skills('launch') -> ${found.length} skills:`,
  found.map((s) => s.id).join(", "),
);

const info = JSON.parse(
  text(await client.callTool({ name: "skill_info", arguments: { skillId: SKILL_ID } })),
);
console.log(`skill_info(${SKILL_ID}):`, info.name, `$${info.priceUsd}`, info.type);

const wallet = JSON.parse(
  text(await client.callTool({ name: "my_wallet", arguments: {} })),
);
console.log("my_wallet:", wallet.buyerAgent, `${wallet.balancePathUsd} pathUSD`);

const exec = JSON.parse(
  text(
    await client.callTool({
      name: "execute_skill",
      arguments: {
        skillId: SKILL_ID,
        brief: "Coordinate the launch posts for the cited.md promo",
      },
    }),
  ),
);
console.log("execute_skill:", JSON.stringify(exec));

let job: { status: string; progress: string[]; deliverable?: unknown; error?: string };
do {
  await new Promise((r) => setTimeout(r, 1000));
  job = JSON.parse(
    text(
      await client.callTool({ name: "job_status", arguments: { jobId: exec.jobId } }),
    ),
  );
  console.log(`job_status: ${job.status} — ${job.progress.length} progress lines`);
} while (job.status === "queued" || job.status === "running");

console.log("terminal state:", job.status);
for (const line of job.progress) console.log("  progress:", line);
if (job.deliverable) console.log("deliverable:", JSON.stringify(job.deliverable));
if (job.error) console.log("error:", job.error);

await client.close();
