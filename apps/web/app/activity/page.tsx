"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_TXS = 1000; // kept in state
const SHOWN_TXS = 300; // rendered rows
const SHOWN_WALLETS = 12;

interface Tx {
  txId: string;
  skillId: string;
  buyerAgent: string;
  sellerAgent: string;
  amountUsd: number;
  rail: string;
  receipt: string;
  timestamp: string;
}

interface Wallet {
  agent: string;
  address: string;
  balancePathUsd: string;
}

interface Skill {
  id: string;
  name: string;
}

const shortHash = (h: string) => (h.length > 18 ? `${h.slice(0, 10)}..${h.slice(-6)}` : h);

/** Dedup by txId, newest first, capped — poll reconciliation and SSE both land here. */
function mergeTxs(prev: Tx[], incoming: Tx[]): Tx[] {
  const byId = new Map(prev.map((t) => [t.txId, t]));
  for (const tx of incoming) byId.set(tx.txId, tx);
  return [...byId.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_TXS);
}

export default function Activity() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [live, setLive] = useState(false);
  // Re-render once a second so the trades/min window slides even without events.
  const [, setTick] = useState(0);
  const latestTxId = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${API}/skills`).then((r) => r.json()).then(setSkills).catch(() => {});
    const load = () => {
      fetch(`${API}/transactions?limit=${MAX_TXS}`)
        .then((r) => r.json())
        .then((list: Tx[]) => setTxs((prev) => mergeTxs(prev, list)))
        .catch(() => {});
      fetch(`${API}/wallets`).then((r) => r.json()).then(setWallets).catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // Live SSE feed: every settled trade lands instantly; polling above reconciles.
  useEffect(() => {
    const es = new EventSource(`${API}/events`);
    es.addEventListener("tx", (e) => {
      const tx = JSON.parse((e as MessageEvent).data) as Tx;
      latestTxId.current = tx.txId;
      setTxs((prev) => mergeTxs(prev, [tx]));
    });
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false); // EventSource auto-reconnects
    return () => es.close();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const skillName = useMemo(() => {
    const m = new Map(skills.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? id;
  }, [skills]);

  const stats = useMemo(() => {
    const volume = txs.reduce((sum, t) => sum + t.amountUsd, 0);
    const buyers = new Set(txs.map((t) => t.buyerAgent)).size;
    const cutoff = Date.now() - 60_000;
    const lastMinute = txs.filter((t) => new Date(t.timestamp).getTime() >= cutoff).length;
    return { trades: txs.length, volume, buyers, lastMinute };
  }, [txs]);

  return (
    <div className="shell">
      <header className="topbar rise">
        <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="brandMark">⌘</div>
          <span className="brandName">Agent App Store</span>
        </a>
        <div className="topRight">
          <a className="navLink" href="/">Store</a>
          <div className="topPill">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                marginRight: 7,
                background: live ? "#34c759" : "#d0d0d0",
                transition: "background 0.3s",
              }}
            />
            {live ? "live" : "connecting"} · settled over <b>MPP</b>
          </div>
        </div>
      </header>

      <section className="hero" style={{ padding: "56px 0 16px" }}>
        <h1 className="rise" style={{ animationDelay: "0.08s", fontSize: "clamp(34px, 4.4vw, 48px)" }}>
          Every trade, <em>on the record.</em>
        </h1>
        <p className="rise" style={{ animationDelay: "0.2s" }}>
          Live custodial wallets and agent-to-agent transactions, settled in
          pathUSD on Tempo testnet.
        </p>
      </section>

      <h3 className="sectionLabel rise" style={{ animationDelay: "0.24s" }}>Market pulse</h3>
      <div className="walletGrid rise" style={{ animationDelay: "0.28s" }}>
        <div className="walletCard">
          <div className="cardName">Trades</div>
          <div className="walletBal">{stats.trades}{stats.trades >= MAX_TXS ? "+" : ""}</div>
        </div>
        <div className="walletCard">
          <div className="cardName">Volume</div>
          <div className="walletBal">
            {stats.volume.toFixed(2)} <span>pathUSD</span>
          </div>
        </div>
        <div className="walletCard">
          <div className="cardName">Buyer agents</div>
          <div className="walletBal">{stats.buyers}</div>
        </div>
        <div className="walletCard">
          <div className="cardName">Trades / min</div>
          <div className="walletBal">{stats.lastMinute}</div>
        </div>
      </div>

      <h3 className="sectionLabel rise" style={{ animationDelay: "0.34s" }}>Agent wallets</h3>
      <div className="walletGrid rise" style={{ animationDelay: "0.38s" }}>
        {wallets.length === 0 && <div className="empty">Loading wallets…</div>}
        {wallets.slice(0, SHOWN_WALLETS).map((w) => (
          <div key={w.address} className="walletCard">
            <div className="cardName">{w.agent}</div>
            <div className="walletAddr" title={w.address}>{shortHash(w.address)}</div>
            <div className="walletBal">
              {w.balancePathUsd} <span>pathUSD</span>
            </div>
          </div>
        ))}
        {wallets.length > SHOWN_WALLETS && (
          <div className="walletCard">
            <div className="cardName">…and</div>
            <div className="walletBal">{wallets.length - SHOWN_WALLETS} more</div>
          </div>
        )}
      </div>

      <h3 className="sectionLabel rise" style={{ animationDelay: "0.42s" }}>Transactions</h3>
      <div className="panel rise" style={{ animationDelay: "0.48s", padding: "10px 24px" }}>
        {txs.length === 0 && <div className="empty" style={{ padding: "14px 0" }}>Waiting for the first trade…</div>}
        {txs.length > 0 && (
          <table className="txTable">
            <thead>
              <tr>
                <th>time</th>
                <th>skill</th>
                <th>buyer → seller</th>
                <th>amount</th>
                <th>on-chain receipt</th>
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, SHOWN_TXS).map((tx) => (
                <tr key={tx.txId} style={tx.txId === latestTxId.current ? { background: "rgba(52, 199, 89, 0.08)" } : undefined}>
                  <td className="txTime">{new Date(tx.timestamp).toLocaleTimeString()}</td>
                  <td>{skillName(tx.skillId)}</td>
                  <td className="txAgents">
                    {tx.buyerAgent} → {tx.sellerAgent}
                  </td>
                  <td className="txAmount">${tx.amountUsd.toFixed(2)}</td>
                  <td className="txReceipt" title={tx.receipt}>{shortHash(tx.receipt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {txs.length > SHOWN_TXS && (
          <div className="empty" style={{ padding: "10px 0" }}>
            showing the latest {SHOWN_TXS} of {txs.length} trades
          </div>
        )}
      </div>
    </div>
  );
}
