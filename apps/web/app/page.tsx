"use client";

import { deliverableLibrary } from "@aas/openui-lib";
import { Renderer } from "@openuidev/react-lang";
import {
  Clapperboard,
  Palette,
  PenLine,
  Telescope,
  Settings2,
  Megaphone,
  BarChart3,
  Sparkles,
  Command,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fmtUsd, Usd } from "./lib/money";

const API = process.env.NEXT_PUBLIC_API_URL ?? ""; // empty = same origin, proxied by next.config rewrites

interface Skill {
  id: string;
  name: string;
  ownerAgent: string;
  type: "service" | "package";
  priceUsd: number;
  description: string;
  category: string;
  rating: number;
  downloads: number;
  tags: string[];
  sourceUrl?: string;
}

interface Tx {
  txId: string;
  skillId: string;
  buyerAgent: string;
  sellerAgent: string;
  amountUsd: number;
  rail: string;
  timestamp: string;
}

interface Job {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: string[];
  deliverable?: { url: string; extras?: Record<string, string> };
  error?: string;
}

const CATEGORY_STYLE: Record<string, { Icon: LucideIcon; bg: string }> = {
  video: { Icon: Clapperboard, bg: "rgba(95,93,77,0.12)" },
  design: { Icon: Palette, bg: "rgba(158,148,139,0.16)" },
  copywriting: { Icon: PenLine, bg: "rgba(136,124,113,0.14)" },
  research: { Icon: Telescope, bg: "rgba(95,93,77,0.09)" },
  engineering: { Icon: Settings2, bg: "#F1F0EF" },
  marketing: { Icon: Megaphone, bg: "rgba(158,148,139,0.12)" },
  data: { Icon: BarChart3, bg: "rgba(136,124,113,0.1)" },
  other: { Icon: Sparkles, bg: "#F1F0EF" },
};

const CATEGORIES = ["all", "video", "design", "copywriting", "research", "engineering", "marketing", "data"];

/** Local mp4 paths in agent-emitted OpenUI point at the API host. */
function rewriteRenderUrls(openui: string): string {
  return openui.replaceAll("/renders/", `${API}/renders/`);
}

export default function Store() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState<Skill | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`${API}/skills`).then((r) => r.json()).then(setSkills).catch(() => {});
      fetch(`${API}/transactions`).then((r) => r.json()).then(setTxs).catch(() => {});
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(
    () =>
      skills.filter(
        (s) =>
          (cat === "all" || s.category === cat) &&
          (!q ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.description.toLowerCase().includes(q.toLowerCase()) ||
            s.tags.some((t) => t.includes(q.toLowerCase()))),
      ),
    [skills, q, cat],
  );

  const leaderboard = useMemo(() => {
    const sales = new Map<string, { n: number; usd: number }>();
    for (const tx of txs) {
      const cur = sales.get(tx.skillId) ?? { n: 0, usd: 0 };
      sales.set(tx.skillId, { n: cur.n + 1, usd: cur.usd + tx.amountUsd });
    }
    return [...sales.entries()]
      .map(([id, v]) => ({ id, ...v, name: skills.find((s) => s.id === id)?.name ?? id }))
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 5);
  }, [txs, skills]);

  return (
    <div className="shell">
      <header className="topbar rise">
        <div className="brand">
          <div className="brandMark"><Command size={20} strokeWidth={2.25} /></div>
          <span className="brandName">Skill Store</span>
        </div>
        <div className="topRight">
          <a className="navLink" href="/activity">Activity</a>
          <div className="topPill">
            settled over <b>MPP</b> · {txs.length} trades today
          </div>
        </div>
      </header>

      <section className="hero">
        <h1 className="rise" style={{ animationDelay: "0.08s" }}>
          Skills owned by agents,
          <br />
          <em>bought by agents.</em>
        </h1>
        <p className="rise" style={{ animationDelay: "0.2s" }}>
          The first storefront of the agent economy. Browse as a human, shop as an
          agent — every skill has an owner, every run is a real transaction.
        </p>
      </section>

      <div className="searchRow rise" style={{ animationDelay: "0.3s" }}>
        <input
          className="search"
          placeholder="Search skills — try “video”, “perfume launch”, “react”…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="pills rise" style={{ animationDelay: "0.38s" }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
            {c === "all" ? "All skills" : c}
          </button>
        ))}
      </div>

      <div className="layout">
        <main className="grid">
          {filtered.map((s, i) => {
            const style = CATEGORY_STYLE[s.category] ?? CATEGORY_STYLE.other;
            return (
              <article
                key={s.id}
                className="card rise"
                style={{ animationDelay: `${0.42 + Math.min(i, 8) * 0.06}s` }}
                onClick={() => setSelected(s)}
              >
                <div className="cardTop">
                  <div className="icon" style={{ background: style.bg }}>
                    <style.Icon size={24} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="cardName">{s.name}</div>
                    <div className="owner">by {s.ownerAgent}</div>
                  </div>
                </div>
                <p className="desc">{s.description}</p>
                <div className="cardFoot">
                  <div className="meta">
                    <span className="stars"><Star size={13} fill="currentColor" strokeWidth={0} /> {s.rating.toFixed(1)}</span>
                    <span>{s.downloads.toLocaleString()}</span>
                    <span className={`badge ${s.type}`}>{s.type}</span>
                  </div>
                  <span className="price"><Usd amount={s.priceUsd} /></span>
                </div>
              </article>
            );
          })}
        </main>

        <aside className="side rise" style={{ animationDelay: "0.55s" }}>
          <div className="panel">
            <h3>Top sellers</h3>
            {leaderboard.length === 0 && <div className="empty">No sales yet today</div>}
            {leaderboard.map((row, i) => (
              <div key={row.id} className="lbRow">
                <span className="lbRank">{i + 1}</span>
                <span>{row.name}</span>
                <span className="lbSales"><Usd amount={row.usd} /></span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>Live transactions</h3>
            {txs.length === 0 && <div className="empty">Waiting for the first trade…</div>}
            {txs.slice(0, 8).map((tx) => (
              <div key={tx.txId} className="txRow">
                <div>
                  <div>{skills.find((s) => s.id === tx.skillId)?.name ?? tx.skillId}</div>
                  <div className="txAgents">
                    {tx.buyerAgent} → {tx.sellerAgent} · {tx.rail.toUpperCase()}
                  </div>
                </div>
                <span className="txAmount"><Usd amount={tx.amountUsd} /></span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {selected && <SkillModal skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SkillModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [brief, setBrief] = useState(
    skill.id === "video-producer"
      ? "A 30-second launch promo for cited.md — the publishing endpoint of the agentic web. Premium, cinematic, optimistic."
      : "",
  );
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const execute = useCallback(async () => {
    setBusy(true);
    const res = await fetch(`${API}/skills/${skill.id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, buyerAgent: "human.via.storefront" }),
    });
    const { jobId } = await res.json();
    pollRef.current = setInterval(async () => {
      const j: Job = await fetch(`${API}/jobs/${jobId}`).then((r) => r.json());
      setJob(j);
      if (j.status === "succeeded" || j.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setBusy(false);
      }
    }, 1500);
  }, [brief, skill.id]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const style = CATEGORY_STYLE[skill.category] ?? CATEGORY_STYLE.other;
  const videoUrl = job?.deliverable?.url?.endsWith(".mp4")
    ? `${API}/renders/${job.deliverable.url.split("/").pop()}`
    : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="closeX" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="cardTop" style={{ marginBottom: 14 }}>
          <div className="icon" style={{ background: style.bg }}>
            <style.Icon size={24} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{skill.name}</h2>
            <div className="owner">
              by {skill.ownerAgent} · {fmtUsd(skill.priceUsd)} per {skill.type === "service" ? "run" : "copy"}
            </div>
          </div>
        </div>
        <p className="desc" style={{ WebkitLineClamp: 99 }}>{skill.description}</p>

        {skill.type === "service" ? (
          <>
            <textarea
              className="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what you want produced…"
            />
            <button className="buyBtn" onClick={execute} disabled={busy || !brief}>
              {busy ? "Working…" : `Buy & run — ${fmtUsd(skill.priceUsd)} via MPP`}
            </button>
          </>
        ) : (
          <a href={skill.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className="buyBtn" style={{ marginTop: 16 }}>
              Buy package — {fmtUsd(skill.priceUsd)} via MPP
            </button>
          </a>
        )}

        {job && (
          <div className="progress">
            {job.progress.map((line, i) => (
              <div key={i} className={i === job.progress.length - 1 ? "last" : ""}>{line}</div>
            ))}
            {job.status === "failed" && <div style={{ color: "#e8927c" }}>✗ {job.error}</div>}
          </div>
        )}
        {job?.deliverable?.extras?.openui ? (
          <div className="ouiWrap">
            <div className="ouiLabel">Deliverable view — designed by {skill.ownerAgent} (OpenUI)</div>
            <Renderer
              response={rewriteRenderUrls(job.deliverable.extras.openui)}
              library={deliverableLibrary}
              isStreaming={false}
            />
          </div>
        ) : (
          videoUrl && <video src={videoUrl} controls autoPlay loop />
        )}
      </div>
    </div>
  );
}
