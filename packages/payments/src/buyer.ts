import { Mppx, tempo } from "mppx/client";
import { getBuyerWallet } from "./wallets.js";

export interface BuyerWallet {
  name: string;
  address: `0x${string}`;
  /** Payment-aware fetch: settles 402 MPP challenges from this wallet, then retries. */
  fetch: typeof globalThis.fetch;
}

/**
 * Buyer-side wallet for agents purchasing skills. The key is persisted in
 * .data/buyer-wallets.json and faucet-funded on Tempo testnet; global fetch
 * is left untouched (polyfill: false).
 */
export async function createBuyerWallet(name: string): Promise<BuyerWallet> {
  const { address, account } = await getBuyerWallet(name);
  const client = Mppx.create({
    methods: [tempo({ account })],
    polyfill: false,
  });
  return { name, address, fetch: client.fetch as typeof globalThis.fetch };
}
