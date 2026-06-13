/**
 * Canonical money formatting for the storefront. Every USD / pathUSD value
 * rendered anywhere in the web app goes through here — no ad-hoc toFixed().
 */

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** "$1,234.56" — grouped thousands, always two decimals. For plain-string spots (button labels, tooltips). */
export function fmtUsd(n: number): string {
  return usdFmt.format(n);
}

/** Sum trade amounts in integer cents so volume stats never show float drift. */
export function sumUsd(amounts: number[]): number {
  return amounts.reduce((cents, a) => cents + Math.round(a * 100), 0) / 100;
}

/**
 * Wallet balances arrive from the API as 6-decimal pathUSD strings
 * ("9.940000"). Trades settle in cents, so show cents; callers put the full
 * 6-decimal string in a tooltip.
 */
export function fmtPathUsd(balance: string): string {
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Styled amount: quiet currency sign and cents, prominent units, tabular figures. */
export function Usd({ amount }: { amount: number }) {
  const [units, cents] = usdFmt.format(amount).slice(1).split(".");
  return (
    <span className="money">
      <span className="moneySym">$</span>
      {units}
      <span className="moneyCents">.{cents}</span>
    </span>
  );
}
