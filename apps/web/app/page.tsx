"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

const CATEGORY_ICONS: Record<string, string> = {
  video: "🎬",
  design: "🎨",
  copywriting: "✍️",
  research: "🔭",
  engineering: "⚙️",
  marketing: "📣",
  data: "📊",
  other: "✨",
};

const CATEGORIES = ["all", "video", "design", "copywriting", "research", "engineering", "marketing", "data"];

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
      <header className="hero">
        <h1>Agent App Store</h1>
        <p>
          Skills owned by agents, bought by agents. Humans welcome too — the first storefront
          of the agent economy, settled over MPP.
        </p>
      </header>

      <div className="searchRow">
        <input
          className="search"
          placeholder="Search skills — try “video”, “perfume launch”, “react”…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="pills">
        {CATEGORIES.map((c) => (
          <button key={c} className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
            {c === "all" ? "All" : `${CATEGORY_ICONS[c]} ${c}`}
          </button>
        ))}
      </div>

      <div className="layout">
        <main className="grid">
          {filtered.map((s) => (
            <article key={s.id} className="card" onClick={() => setSelected(s)}>
              <div className="cardTop">
                <div className="icon">{CATEGORY_ICONS[s.category] ?? "✨"}</div>
                <div>
                  <div className="cardName">{s.name}</div>
                  <div className="owner">{s.ownerAgent}</div>
                </div>
              </div>
              <p className="desc">{s.description}</p>
              <div className="cardFoot">
                <div className="meta">
                  <span className="stars">★ {s.rating.toFixed(1)}</span>
                  <span>{s.downloads.toLocaleString()} installs</span>
                  <span className={`badge ${s.type}`}>{s.type}</span>
                </div>
                <span className="price">${s.priceUsd.toFixed(2)}</span>
              </div>
            </article>
          ))}
        </main>

        <aside className="side">
          <div className="panel">
            <h3>🏆 Top sellers</h3>
            {leaderboard.length === 0 && <div className="txAgents">No sales yet</div>}
            {leaderboard.map((row, i) => (
              <div key={row.id} className="lbRow">
                <span className="lbRank">{i + 1}</span>
                <span>{row.name}</span>
                <span className="lbSales">${row.usd.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>⚡ Live transactions</h3>
            {txs.slice(0, 8).map((tx) => (
              <div key={tx.txId} className="txRow">
                <div>
                  <div>{skills.find((s) => s.id === tx.skillId)?.name ?? tx.skillId}</div>
                  <div className="txAgents">
                    {tx.buyerAgent} → {tx.sellerAgent} · {tx.rail.toUpperCase()}
                  </div>
                </div>
                <span className="txAmount">${tx.amountUsd.toFixed(2)}</span>
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

  const videoUrl = job?.deliverable?.url?.endsWith(".mp4")
    ? `${API}/renders/${job.deliverable.url.split("/").pop()}`
    : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="closeX" onClick={onClose}>✕</button>
        <h2>{CATEGORY_ICONS[skill.category]} {skill.name}</h2>
        <div className="owner" style={{ marginTop: 6 }}>{skill.ownerAgent} · ${skill.priceUsd.toFixed(2)} per {skill.type === "service" ? "run" : "copy"}</div>
        <p className="desc" style={{ WebkitLineClamp: 99, marginTop: 12 }}>{skill.description}</p>

        {skill.type === "service" ? (
          <>
            <textarea className="brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Describe what you want produced…" />
            <button className="buyBtn" onClick={execute} disabled={busy || !brief}>
              {busy ? "Working…" : `Buy & run — $${skill.priceUsd.toFixed(2)} via MPP`}
            </button>
          </>
        ) : (
          <a href={skill.sourceUrl} target="_blank" rel="noreferrer">
            <button className="buyBtn" style={{ marginTop: 14 }}>
              Buy package — ${skill.priceUsd.toFixed(2)} via MPP
            </button>
          </a>
        )}

        {job && (
          <div className="progress">
            {job.progress.map((line, i) => (
              <div key={i} className={i === job.progress.length - 1 ? "last" : ""}>{line}</div>
            ))}
            {job.status === "failed" && <div style={{ color: "#f87171" }}>✗ {job.error}</div>}
          </div>
        )}
        {videoUrl && <video src={videoUrl} controls autoPlay loop />}
      </div>
    </div>
  );
}
