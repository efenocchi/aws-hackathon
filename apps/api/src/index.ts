import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import type {
  ExecuteRequest,
  JobStatus,
  SkillListing,
  Transaction,
} from "@aas/contracts";
import { createPaymentGate, type PaymentVariables } from "@aas/payments";
import { complete, produceVideo } from "@aas/video-producer";
import { insertTransaction } from "./clickhouse.js";
import { SEED_SKILLS } from "./seed.js";

const skills = new Map<string, SkillListing>(SEED_SKILLS.map((s) => [s.id, s]));
const jobs = new Map<string, JobStatus>();
const transactions: Transaction[] = [];

const app = new Hono<{ Variables: PaymentVariables }>();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, skills: skills.size }));

app.get("/skills", (c) => {
  const q = c.req.query("q")?.toLowerCase();
  const category = c.req.query("category");
  let list = [...skills.values()];
  if (category) list = list.filter((s) => s.category === category);
  if (q)
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)),
    );
  return c.json(list.sort((a, b) => b.downloads - a.downloads));
});

app.get("/skills/:id", (c) => {
  const skill = skills.get(c.req.param("id"));
  return skill ? c.json(skill) : c.json({ error: "not found" }, 404);
});

// MPP payment gate: charges skill.priceUsd in pathUSD (Tempo testnet) to the
// owner agent's wallet. Unpaid requests get a 402 challenge and never reach
// the handler — no job, no transaction.
const paymentGate = createPaymentGate({ getSkill: (id) => skills.get(id) });

app.post("/skills/:id/execute", paymentGate, async (c) => {
  const skill = skills.get(c.req.param("id"));
  if (!skill) return c.json({ error: "not found" }, 404);
  if (skill.type !== "service")
    return c.json({ error: "package skills are purchased, not executed" }, 400);

  const payment = c.get("paymentReceipt");
  if (!payment) return c.json({ error: "payment receipt missing" }, 500);

  const body = (await c.req.json()) as ExecuteRequest;
  if (!body.brief) return c.json({ error: "brief required" }, 400);

  const jobId = randomUUID();
  const now = new Date().toISOString();
  const job: JobStatus = {
    jobId,
    skillId: skill.id,
    status: "queued",
    progress: [],
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(jobId, job);

  recordTransaction({
    txId: randomUUID(),
    skillId: skill.id,
    buyerAgent: body.buyerAgent ?? "anonymous.agent",
    sellerAgent: skill.ownerAgent,
    amountUsd: skill.priceUsd,
    rail: "mpp",
    receipt: payment.reference,
    timestamp: now,
  });

  runJob(skill, body, job).catch((err) => {
    job.status = "failed";
    job.error = String(err?.message ?? err);
    job.updatedAt = new Date().toISOString();
  });

  return c.json({ jobId });
});

app.get("/jobs/:id", (c) => {
  const job = jobs.get(c.req.param("id"));
  return job ? c.json(job) : c.json({ error: "not found" }, 404);
});

app.get("/transactions", (c) => c.json(transactions.slice(-100).reverse()));

// Rendered videos (local dev; S3 presigned URLs in prod).
app.get("/renders/:file", async (c) => {
  const { createReadStream, existsSync } = await import("node:fs");
  const { join, basename } = await import("node:path");
  const dir = process.env.RENDERS_DIR ?? join(process.cwd(), "../../renders");
  const path = join(dir, basename(c.req.param("file")));
  if (!existsSync(path)) return c.json({ error: "not found" }, 404);
  c.header("Content-Type", "video/mp4");
  return c.body(createReadStream(path) as unknown as ReadableStream);
});

function recordTransaction(tx: Transaction) {
  transactions.push(tx);
  void insertTransaction(tx); // no-op until CLICKHOUSE_URL is set
}

async function runJob(skill: SkillListing, req: ExecuteRequest, job: JobStatus) {
  job.status = "running";
  const log = (line: string) => {
    job.progress.push(line);
    job.updatedAt = new Date().toISOString();
    console.log(`[job ${job.jobId.slice(0, 8)}] ${line}`);
  };

  switch (skill.id) {
    case "video-producer": {
      const result = await produceVideo(req.brief, { onProgress: log, params: req.params });
      job.deliverable = { url: result.videoUrl, extras: result.extras };
      break;
    }
    case "copywriter": {
      log(`✍️ Copywriter drafting launch copy for: ${req.brief}`);
      const copy = await complete(
        "You are a senior launch copywriter. Given a brief, return markdown with: 3 headline options, a 2-paragraph announcement, and 2 short social post variants. Premium, confident voice. No preamble.",
        req.brief,
      );
      job.deliverable = { url: `data:text/markdown`, extras: { copy } };
      log("✅ Copy delivered");
      break;
    }
    default:
      // Remaining service skills are demo stubs until implemented.
      log(`Executing ${skill.name} for brief: ${req.brief}`);
      await new Promise((r) => setTimeout(r, 1500));
      job.deliverable = {
        url: `https://example.com/deliverables/${job.jobId}.md`,
        extras: { note: "stub deliverable" },
      };
  }

  job.status = "succeeded";
  job.updatedAt = new Date().toISOString();
}

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
console.log(`Agent App Store API on :${port} — ${skills.size} skills listed`);
