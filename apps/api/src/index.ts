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
import { OPENUI_SYSTEM_PROMPT } from "@aas/openui-lib";
import { insertTransaction } from "./clickhouse.js";
import { announceDeliverable, composioEnabled } from "./composio.js";
import { DEMO_CITIES, pointForecast } from "./jua.js";
import { pioneerComplete, pioneerEnabled } from "./pioneer.js";
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

/**
 * OpenUI (sponsor): the seller agent designs its own deliverable view — the
 * director emits OpenUI Lang that the storefront renders. Non-fatal on failure.
 */
/** Composio (sponsor): announce the finished deliverable on Slack. Non-fatal. */
async function announceOnSocials(
  job: JobStatus,
  skill: SkillListing,
  req: ExecuteRequest,
  log: (l: string) => void,
) {
  if (!composioEnabled() || !job.deliverable) return;
  try {
    log("📣 Posting the deliverable to Slack via Composio...");
    await announceDeliverable({
      skillName: skill.name,
      buyerAgent: req.buyerAgent ?? "anonymous.agent",
      tagline: job.deliverable.extras?.tagline,
      videoUrl: job.deliverable.url,
    });
    log("📣 Posted");
  } catch (err) {
    log(`⚠️ Composio post skipped: ${String((err as Error).message)}`);
  }
}

async function attachOpenUI(job: JobStatus, log: (l: string) => void) {
  if (!job.deliverable) return;
  try {
    log("🎨 Agent is designing its deliverable view (OpenUI)...");
    const videoFile = job.deliverable.url.split("/").pop();
    const data = {
      concept: job.deliverable.extras?.concept,
      tagline: job.deliverable.extras?.tagline,
      shots: JSON.parse(job.deliverable.extras?.storyboard ?? "[]"),
      keyframeUrls: JSON.parse(job.deliverable.extras?.keyframes ?? "[]"),
      videoUrl: `/renders/${videoFile}`,
    };
    let openui = await complete(OPENUI_SYSTEM_PROMPT, JSON.stringify(data));
    // Strip markdown fences / surrounding prose if the model added any.
    const fence = openui.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (fence) openui = fence[1];
    job.deliverable.extras = { ...job.deliverable.extras, openui };
    log("🎨 Deliverable view ready");
  } catch (err) {
    log(`⚠️ OpenUI view skipped: ${String((err as Error).message)}`);
  }
}

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
      await attachOpenUI(job, log);
      await announceOnSocials(job, skill, req, log);
      break;
    }
    case "copywriter": {
      const COPY_SYSTEM =
        "You are a senior launch copywriter. Given a brief, return markdown with: 3 headline options, a 2-paragraph announcement, and 2 short social post variants. Premium, confident voice. No preamble.";
      // Pioneer (sponsor): adaptive inference that improves with traffic — every
      // copy job routed through it is training signal. Claude fallback without key.
      if (pioneerEnabled()) {
        log(`✍️ Copywriter drafting via Pioneer adaptive inference: ${req.brief}`);
        const copy = await pioneerComplete(COPY_SYSTEM, req.brief);
        job.deliverable = { url: `data:text/markdown`, extras: { copy, provider: "pioneer" } };
      } else {
        log(`✍️ Copywriter drafting launch copy for: ${req.brief}`);
        const copy = await complete(COPY_SYSTEM, req.brief);
        job.deliverable = { url: `data:text/markdown`, extras: { copy, provider: "claude" } };
      }
      log("✅ Copy delivered");
      break;
    }
    case "weather-promo": {
      // Jua (sponsor): real forecast for the launch city conditions the creative.
      const city = Object.keys(DEMO_CITIES).find((c) =>
        req.brief.toLowerCase().includes(c),
      );
      if (!city) {
        log(`⚠️ No known city in brief — supported: ${Object.keys(DEMO_CITIES).join(", ")}`);
        throw new Error("brief must name a launch city, e.g. \"perfume launch in Paris\"");
      }
      const [lat, lon] = DEMO_CITIES[city];
      log(`🌍 Querying Jua earth model for ${city} (${lat}, ${lon})...`);
      const forecast = await pointForecast(lat, lon, city);
      log(`🌦️ Forecast retrieved — conditioning the creative on real weather`);
      const result = await produceVideo(
        `${req.brief}\n\nReal forecast data for ${city} (weave the actual conditions into the visual mood): ${forecast.summary}`,
        { onProgress: log, params: req.params },
      );
      job.deliverable = { url: result.videoUrl, extras: { ...result.extras, forecast: forecast.summary.slice(0, 500) } };
      await attachOpenUI(job, log);
      await announceOnSocials(job, skill, req, log);
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
