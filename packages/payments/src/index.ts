/**
 * @aas/payments — real MPP payments on Tempo testnet for the Agent App Store.
 *
 * Seller side: createPaymentGate() gates skill execution endpoints behind a
 * pathUSD charge to the owner agent's custodial wallet.
 * Buyer side: createBuyerWallet() returns a payment-aware fetch that settles
 * 402 challenges automatically.
 */
export { createBuyerWallet, type BuyerWallet } from "./buyer.js";
export {
  createPaymentGate,
  type PaymentReceipt,
  type PaymentVariables,
} from "./gate.js";
export {
  PATH_USD,
  PATH_USD_DECIMALS,
  dataDir,
  getAgentWallet,
  getBuyerWallet,
  getMppSecretKey,
  listManagedWallets,
  pathUsdBalance,
  tempoClient,
  type ManagedWallet,
} from "./wallets.js";
