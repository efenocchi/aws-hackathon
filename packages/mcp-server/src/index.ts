/**
 * Remote MCP server over Streamable HTTP.
 *
 * Stateless mode: every POST /mcp gets a fresh transport + server instance,
 * so any MCP client (Claude Code: `claude mcp add --transport http appstore
 * http://host:4500/mcp`) can use the marketplace with no API key — payments
 * are settled server-side by this process's wallet.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createBuyer, repoRoot } from "./buyer.js";
import { MarketClient } from "./market.js";
import { buildMcpServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 4500);
const MARKET_URL = process.env.MARKET_URL ?? "http://localhost:4000";
const WALLET_FILE =
  process.env.WALLET_FILE ?? join(repoRoot(), ".data", "mcp-wallet.json");

console.log(`loading buyer wallet from ${WALLET_FILE} (faucet-funds if new)...`);
const buyer = await createBuyer({ walletFile: WALLET_FILE, agentPrefix: "mcp" });
console.log(`buyer ${buyer.agentId} — ${await buyer.balance()} pathUSD`);

const market = new MarketClient(MARKET_URL, buyer.fetch);

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  const body = req.method === "POST" ? await readBody(req) : undefined;
  // sessionIdGenerator: undefined -> stateless; enableJsonResponse -> plain
  // JSON replies (curl-friendly) instead of an SSE stream.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildMcpServer(market, buyer);
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const httpServer = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, market: MARKET_URL, buyer: buyer.agentId }));
    return;
  }
  if (path !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found — MCP endpoint is POST /mcp" }));
    return;
  }
  handleMcp(req, res).catch((err) => {
    console.error("mcp request failed:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: String((err as Error)?.message ?? err) },
          id: null,
        }),
      );
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Agent App Store MCP server on :${PORT} (POST /mcp) -> market ${MARKET_URL}`);
});
