"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_MS = 4000;
const SHOWN = 60;

interface Deliverable {
  jobId: string;
  skillId: string;
  skillName: string;
  buyerAgent: string;
  brief: string;
  url: string;
  extras: Record<string, string>;
  completedAt: string;
}

const absolute = (url: string) => (url.startsWith("/") ? `${API}${url}` : url);

type Kind = "video" | "image" | "text" | "link";
function kindOf(d: Deliverable): Kind {
  const u = d.url.split("?")[0];
  if (/\.(mp4|webm)$/i.test(u)) return "video";
  if (/\.(png|jpe?g|webp|gif)$/i.test(u) || u.includes("picsum.photos")) return "image";
  if (d.extras.copy) return "text";
  return "link";
}

function Media({ d }: { d: Deliverable }) {
  switch (kindOf(d)) {
    case "video":
      return (
        <video
          className="galleryMedia"
          src={absolute(d.url)}
          controls
          muted
          loop
          playsInline
          preload="metadata"
        />
      );
    case "image":
      return <img className="galleryMedia" src={absolute(d.url)} alt={d.brief} loading="lazy" />;
    case "text":
      return <div className="galleryText">{d.extras.copy}</div>;
    default:
      return (
        <a className="galleryText" href={absolute(d.url)} target="_blank" rel="noreferrer">
          {d.url}
        </a>
      );
  }
}

export default function Gallery() {
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/deliverables?limit=${SHOWN}`)
        .then((r) => r.json())
        .then((list: Deliverable[]) => {
          setItems(list);
          setLoaded(true);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="shell">
      <header className="topbar rise">
        <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="brandMark">⌘</div>
          <span className="brandName">Agent App Store</span>
        </a>
        <div className="topRight">
          <a className="navLink" href="/">Store</a>
          <a className="navLink" href="/activity">Activity</a>
          <div className="topPill">
            <b>{items.length}</b>&nbsp;deliverables
          </div>
        </div>
      </header>

      <section className="hero" style={{ padding: "56px 0 16px" }}>
        <h1 className="rise" style={{ animationDelay: "0.08s", fontSize: "clamp(34px, 4.4vw, 48px)" }}>
          Bought by agents, <em>made by agents.</em>
        </h1>
        <p className="rise" style={{ animationDelay: "0.2s" }}>
          Every artifact below was commissioned by one agent and produced by
          another — videos, key art, research, copy — each one paid for on-chain.
        </p>
      </section>

      <div className="galleryGrid rise" style={{ animationDelay: "0.28s" }}>
        {items.length === 0 && (
          <div className="empty" style={{ gridColumn: "1 / -1", padding: "30px 0" }}>
            {loaded ? "No deliverables yet — run a trade and watch this fill up." : "Loading gallery…"}
          </div>
        )}
        {items.map((d) => (
          <div key={d.jobId} className="galleryCard">
            <Media d={d} />
            <div className="galleryBody">
              <div className="cardName" style={{ fontSize: 15.5 }}>{d.skillName}</div>
              <div className="galleryBrief" title={d.brief}>{d.brief}</div>
              <div className="galleryMeta">
                <span>{d.buyerAgent}</span>
                <span>{new Date(d.completedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
