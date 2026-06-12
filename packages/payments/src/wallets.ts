import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient, erc20Abi, http, publicActions } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Actions } from "viem/tempo";
import { tempoModerato } from "viem/tempo/chains";

/** pathUSD TIP-20 token on Tempo testnet (Moderato). */
export const PATH_USD = "0x20c0000000000000000000000000000000000000" as const;
export const PATH_USD_DECIMALS = 6;

/** Where wallet keys and the MPP secret live. Override with AAS_DATA_DIR. */
export function dataDir(): string {
  return resolve(process.env.AAS_DATA_DIR ?? ".data");
}

let chainClient: ReturnType<typeof makeChainClient> | undefined;
function makeChainClient() {
  return createClient({ chain: tempoModerato, transport: http() }).extend(
    publicActions,
  );
}

/** Shared public client for Tempo testnet (Moderato). */
export function tempoClient() {
  chainClient ??= makeChainClient();
  return chainClient;
}

/** On-chain pathUSD balance (raw units, 6 decimals). */
export async function pathUsdBalance(address: `0x${string}`): Promise<bigint> {
  return tempoClient().readContract({
    address: PATH_USD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

interface WalletRecord {
  privateKey: `0x${string}`;
  address: `0x${string}`;
}

export interface ManagedWallet {
  name: string;
  address: `0x${string}`;
  account: PrivateKeyAccount;
}

function loadRegistry(file: string): Record<string, WalletRecord> {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveRegistry(file: string, registry: Record<string, WalletRecord>) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(file, JSON.stringify(registry, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

// Faucet funding is per-address idempotent within a run; the threshold only
// re-funds wallets a previous run drained.
const TOP_UP_THRESHOLD = 10n * 10n ** BigInt(PATH_USD_DECIMALS);

async function ensureWallet(
  registryFile: string,
  name: string,
  { topUp }: { topUp: boolean },
): Promise<ManagedWallet> {
  const file = join(dataDir(), registryFile);
  const registry = loadRegistry(file);
  let record = registry[name];
  let created = false;
  if (!record) {
    const privateKey = generatePrivateKey();
    record = { privateKey, address: privateKeyToAccount(privateKey).address };
    registry[name] = record;
    saveRegistry(file, registry);
    created = true;
  }
  if (created || (topUp && (await pathUsdBalance(record.address)) < TOP_UP_THRESHOLD)) {
    await Actions.faucet.fundSync(tempoClient(), { account: record.address });
  }
  return {
    name,
    address: record.address,
    account: privateKeyToAccount(record.privateKey),
  };
}

/**
 * Custodial wallet for a seller agent (the marketplace holds the key).
 * Auto-created and faucet-funded on first use; persisted in
 * .data/agent-wallets.json keyed by the ownerAgent string.
 */
export async function getAgentWallet(ownerAgent: string): Promise<ManagedWallet> {
  return ensureWallet("agent-wallets.json", ownerAgent, { topUp: false });
}

/** Persisted buyer wallet, faucet-funded (topped up when drained below 10 pathUSD). */
export async function getBuyerWallet(name: string): Promise<ManagedWallet> {
  return ensureWallet("buyer-wallets.json", name, { topUp: true });
}

/**
 * HMAC secret binding MPP challenges to their contents.
 * MPP_SECRET_KEY env wins; otherwise generated once and persisted to
 * .data/mpp-secret so challenges survive restarts.
 */
export function getMppSecretKey(): string {
  if (process.env.MPP_SECRET_KEY) return process.env.MPP_SECRET_KEY;
  const file = join(dataDir(), "mpp-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const key = generatePrivateKey();
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(file, key, { mode: 0o600 });
  return key;
}
