import type { SkillListing } from "@aas/contracts";
import type { MiddlewareHandler } from "hono";
import { Receipt } from "mppx";
import { Mppx, tempo } from "mppx/server";
import { getAgentWallet, getMppSecretKey } from "./wallets.js";

/** Settled-payment details the gate exposes to the downstream route handler. */
export interface PaymentReceipt {
  /** Method-specific reference — the Tempo transaction hash. */
  reference: string;
  method: string;
  timestamp: string;
  /** Raw base64url Payment-Receipt header value (also returned to the buyer). */
  header: string;
}

export type PaymentVariables = { paymentReceipt?: PaymentReceipt };

// Generous TTL: this host's clock drifts (NTP broken) and a short expiry
// makes the on-chain transfer revert with "transaction expired".
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function createSellerServer(recipient: `0x${string}`) {
  return Mppx.create({
    secretKey: getMppSecretKey(),
    methods: [tempo({ testnet: true, recipient })],
  });
}

/**
 * Hono middleware gating POST /skills/:id/execute behind a real MPP charge
 * on Tempo testnet. Charges skill.priceUsd in pathUSD to the owner agent's
 * custodial wallet. Unpaid requests get a 402 + WWW-Authenticate challenge
 * and never reach the route handler; paid requests run with the settled
 * receipt available via c.get("paymentReceipt").
 *
 * Non-service or unknown skill ids pass through unpaid — the route handler
 * owns those 404/400 responses.
 */
export function createPaymentGate(options: {
  getSkill: (id: string) => SkillListing | undefined;
}): MiddlewareHandler<{ Variables: PaymentVariables }> {
  const { getSkill } = options;
  const servers = new Map<string, ReturnType<typeof createSellerServer>>();

  async function serverFor(ownerAgent: string) {
    const wallet = await getAgentWallet(ownerAgent);
    let server = servers.get(wallet.address);
    if (!server) {
      server = createSellerServer(wallet.address);
      servers.set(wallet.address, server);
    }
    return server;
  }

  return async (c, next) => {
    const skill = getSkill(c.req.param("id"));
    if (!skill || skill.type !== "service") return next();

    const mppx = await serverFor(skill.ownerAgent);
    const result = await mppx.charge({
      amount: String(skill.priceUsd),
      expires: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      scope: `${c.req.method.toUpperCase()} ${c.req.routePath || c.req.path}`,
    })(c.req.raw);

    if (result.status === 402) return result.challenge;

    // Management responses (e.g. session handshakes) terminate here, before
    // the route handler.
    let management: Response | null = null;
    try {
      management = result.withReceipt();
    } catch (err) {
      if (!Mppx.isMissingReceiptResponseError(err)) throw err;
    }
    if (management) return management;

    // The receipt lives in the middleware result's closure; materialize it on
    // a probe response (respondReceipt is pure) so the handler can record the
    // real on-chain reference.
    const header = result
      .withReceipt(new Response(null))
      .headers.get("Payment-Receipt");
    if (!header)
      throw new Error("mppx settled the charge but attached no Payment-Receipt");
    const receipt = Receipt.deserialize(header);
    c.set("paymentReceipt", {
      reference: receipt.reference,
      method: receipt.method,
      timestamp: receipt.timestamp,
      header,
    });

    await next();
    c.res = result.withReceipt(c.res);
  };
}
