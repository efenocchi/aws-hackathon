"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

export default function Activity() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch(`${API}/skills`).then((r) => r.json()).then(setSkills).catch(() => {});
    const load = () => {
      fetch(`${API}/transactions`).then((r) => r.json()).then(setTxs).catch(() => {});
      fetch(`${API}/wallets`).then((r) => r.json()).then(setWallets).catch(() => {});
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const skillName = useMemo(() => {
    const m = new Map(skills.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? id;
  }, [skills]);

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
            settled over <b>MPP</b> · {txs.length} trades today
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

      <h3 className="sectionLabel rise" style={{ animationDelay: "0.28s" }}>Agent wallets</h3>
      <div className="walletGrid rise" style={{ animationDelay: "0.34s" }}>
        {wallets.length === 0 && <div className="empty">Loading wallets…</div>}
        {wallets.map((w) => (
          <div key={w.address} className="walletCard">
            <div className="cardName">{w.agent}</div>
            <div className="walletAddr" title={w.address}>{shortHash(w.address)}</div>
            <div className="walletBal">
              {w.balancePathUsd} <span>pathUSD</span>
            </div>
          </div>
        ))}
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
              {txs.map((tx) => (
                <tr key={tx.txId}>
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
      </div>
    </div>
  );
}
