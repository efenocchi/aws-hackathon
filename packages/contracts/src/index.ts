/**
 * Shared contracts between the marketplace (Kamo) and the payments/broker layer (Emanuele).
 * Changing anything here requires a ping in the team channel — both halves depend on it.
 */

/** A skill listed on the Skill Store. */
export interface SkillListing {
  id: string;
  name: string;
  /** The agent that owns this skill. Ownership is the economic primitive: one skill, one owner. */
  ownerAgent: string;
  /**
   * "service"  — executed by the owner agent; buyer pays per execution (MPP-gated endpoint).
   * "package"  — one-time purchase delivers the skill artifact (SKILL.md bundle).
   */
  type: "service" | "package";
  /** Price in USD. Per-execution for services, one-time for packages. */
  priceUsd: number;
  /** For services: the MPP-gated execution endpoint. */
  endpoint?: string;
  /** For packages: where the artifact tarball/markdown lives after purchase. */
  artifactUrl?: string;
  description: string;
  category:
    | "video"
    | "design"
    | "copywriting"
    | "research"
    | "engineering"
    | "marketing"
    | "data"
    | "other";
  /** 0–5, seeded for scraped skills, real for ours. */
  rating: number;
  downloads: number;
  /** Upstream origin for scraped open-source skills (GitHub/Vercel URL). */
  sourceUrl?: string;
  tags: string[];
  createdAt: string;
}

/** POST /skills/:id/execute (MPP-gated) request body. */
export interface ExecuteRequest {
  /** Natural-language brief from the buyer, e.g. "30s launch promo for cited.md". */
  brief: string;
  /** Buyer agent identity, recorded on the transaction. */
  buyerAgent: string;
  /** Optional structured params a skill may accept. */
  params?: Record<string, unknown>;
}

/** POST /skills/:id/execute response. */
export interface ExecuteResponse {
  jobId: string;
}

/** GET /jobs/:id response. Poll until status is terminal. */
export interface JobStatus {
  jobId: string;
  skillId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  /** Echo of the buyer's brief — shown on gallery cards. */
  brief?: string;
  /** Buyer agent identity, for attribution on gallery cards. */
  buyerAgent?: string;
  /** Human-readable progress lines, appended as the skill works (drives the demo UI). */
  progress: string[];
  /** Set when status === "succeeded". */
  deliverable?: {
    /** Primary artifact, e.g. the rendered MP4 URL. */
    url: string;
    /** Extra artifacts: storyboard JSON, keyframes, published cited.md URL, etc. */
    extras?: Record<string, string>;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** A completed purchase, written to ClickHouse and shown on the leaderboard. */
export interface Transaction {
  txId: string;
  skillId: string;
  buyerAgent: string;
  sellerAgent: string;
  amountUsd: number;
  rail: "mpp" | "x402";
  /** Payment receipt id / tx hash from the rail, for the on-stage proof moment. */
  receipt: string;
  timestamp: string;
  /** "invocation" = pay-per-execution of a service; "purchase" = one-time package buy. */
  kind?: "invocation" | "purchase";
}

/** POST /skills/:id/purchase (MPP-gated) response — package skills only. */
export interface PurchaseResponse {
  skillId: string;
  /** Where to download the purchased SKILL.md artifact. */
  artifactUrl: string;
  sourceUrl?: string;
  /** On-chain payment reference (Tempo tx hash). */
  receipt: string;
  purchasedAt: string;
}

export const API_ROUTES = {
  catalog: "GET /skills?q=&category=",
  skill: "GET /skills/:id",
  execute: "POST /skills/:id/execute", // MPP middleware gates this
  purchase: "POST /skills/:id/purchase", // MPP-gated one-time package buy
  job: "GET /jobs/:id",
  transactions: "GET /transactions", // leaderboard feed
  deliverables: "GET /deliverables?limit=", // succeeded jobs with artifacts, for the gallery
} as const;
