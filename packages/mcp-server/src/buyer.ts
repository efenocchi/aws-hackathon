/**
 * Buyer-side payment identity shared by the MCP server and the broker.
 *
 * A buyer is a persisted Tempo testnet wallet (faucet-funded on first use)
 * wrapped in an mppx client whose `fetch` transparently settles 402 Payment
 * Required challenges. Against an ungated endpoint the same fetch is a
 * passthrough, so callers never branch on whether MPP gating has landed.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { createClient, erc20Abi, formatUnits, http, publicActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tempoModerato } from "viem/tempo/chains";
import { Mppx, tempo } from "mppx/client";

/** pathUSD stablecoin on Tempo testnet (6 decimals). */
export const PATH_USD = "0x20c0000000000000000000000000000000000000" as const;

/** Walks up to the pnpm workspace root so wallet files land in <repo>/.data. */
export function repoRoot(from = process.cwd()): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) return resolve(from);
    dir = parent;
  }
  return dir;
}

const chain = createClient({ chain: tempoModerato, transport: http() }).extend(
  publicActions,
);

export type MppxBuyerClient = ReturnType<typeof Mppx.create>;

export interface Buyer {
  address: `0x${string}`;
  /** Identity recorded as buyerAgent on transactions, e.g. "mcp:0x20c0..ab12". */
  agentId: string;
  /** Payment-aware fetch: answers 402 challenges, passthrough when ungated. */
  fetch: typeof globalThis.fetch;
  /** The mppx client — subscribe to payment events via .on()/.onChallengeReceived()/... */
  mppx: MppxBuyerClient;
  /** Current pathUSD balance, human units (6 decimals). */
  balance(): Promise<string>;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}..${address.slice(-4)}`;
}

function loadOrCreateWallet(file: string): {
  privateKey: `0x${string}`;
  created: boolean;
} {
  const dataRoot = process.env.AAS_DATA_DIR
    ? resolve(process.env.AAS_DATA_DIR)
    : join(repoRoot(), ".data");
  const resolved = resolve(file);
  if (!resolved.startsWith(dataRoot + sep))
    throw new Error(
      `wallet file must live under ${dataRoot} (got ${resolved}) — refusing to put key material elsewhere; set AAS_DATA_DIR to relocate the data root explicitly`,
    );
  if (existsSync(file)) {
    chmodSync(file, 0o600);
    const saved = JSON.parse(readFileSync(file, "utf8")) as {
      privateKey: `0x${string}`;
    };
    return { privateKey: saved.privateKey, created: false };
  }
  const privateKey = generatePrivateKey();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      { privateKey, address: privateKeyToAccount(privateKey).address },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return { privateKey, created: true };
}

export async function createBuyer(opts: {
  walletFile: string;
  /** Prefix for the buyerAgent identity, e.g. "mcp" or "broker". */
  agentPrefix: string;
}): Promise<Buyer> {
  const { privateKey, created } = loadOrCreateWallet(opts.walletFile);
  const account = privateKeyToAccount(privateKey);

  const balance = async () =>
    formatUnits(
      await chain.readContract({
        address: PATH_USD,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      6,
    );

  if (created || (await balance()) === "0") {
    const { Actions } = await import("viem/tempo");
    await Actions.faucet.fundSync(chain, { account: account.address });
  }

  // polyfill:false — never hijack globalThis.fetch inside a long-lived server.
  const mppx = Mppx.create({ methods: [tempo({ account })], polyfill: false });

  return {
    address: account.address,
    agentId: `${opts.agentPrefix}:${shortAddress(account.address)}`,
    fetch: mppx.fetch as typeof globalThis.fetch,
    mppx,
    balance,
  };
}

/** Human line for a 402 challenge: "0.4 pathUSD -> 0xseller..addr". */
export function describeChallenge(challenge: {
  request: Record<string, unknown>;
}): string {
  const req = challenge.request as { amount?: string; recipient?: string };
  const usd = req.amount ? formatUnits(BigInt(req.amount), 6) : "?";
  return `${usd} pathUSD -> ${req.recipient ?? "?"}`;
}

/** Payment receipt attached by the seller after a settled 402 retry. */
export function receiptOf(response: {
  headers: { get(name: string): string | null };
}): string | undefined {
  return response.headers.get("payment-receipt") ?? undefined;
}
