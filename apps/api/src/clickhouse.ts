/**
 * ClickHouse telemetry: every marketplace transaction and skill execution lands
 * here. Powers the leaderboard at scale and the "seller agent queries its own
 * sales via ClickHouse MCP" demo beat. No-ops until CLICKHOUSE_URL is set.
 */
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { Transaction } from "@aas/contracts";

let client: ClickHouseClient | null = null;
let ready = false;

function getClient(): ClickHouseClient | null {
  if (!process.env.CLICKHOUSE_URL) return null;
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD ?? "",
    });
  }
  return client;
}

export async function ensureTables(): Promise<void> {
  const ch = getClient();
  if (!ch || ready) return;
  await ch.command({
    query: `CREATE TABLE IF NOT EXISTS transactions (
      tx_id String,
      skill_id String,
      buyer_agent String,
      seller_agent String,
      amount_usd Float64,
      rail String,
      receipt String,
      ts DateTime64(3)
    ) ENGINE = MergeTree ORDER BY ts`,
  });
  ready = true;
}

export async function insertTransaction(tx: Transaction): Promise<void> {
  const ch = getClient();
  if (!ch) return;
  try {
    await ensureTables();
    await ch.insert({
      table: "transactions",
      values: [
        {
          tx_id: tx.txId,
          skill_id: tx.skillId,
          buyer_agent: tx.buyerAgent,
          seller_agent: tx.sellerAgent,
          amount_usd: tx.amountUsd,
          rail: tx.rail,
          receipt: tx.receipt,
          ts: tx.timestamp.replace("T", " ").replace("Z", ""),
        },
      ],
      format: "JSONEachRow",
    });
  } catch (err) {
    console.error("[clickhouse] insert failed:", err);
  }
}
