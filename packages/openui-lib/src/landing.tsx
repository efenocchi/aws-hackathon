/**
 * OpenUI (sponsor) — landing-page deliverable. ONE self-contained component
 * with flat, structured props (no nested component references — those don't
 * materialize through the Renderer). The seller agent emits a single
 * LandingPage(...) call; the storefront renders the whole launch page live.
 */
import { createLibrary, createParser, defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";

const font = "'Inter Tight', -apple-system, sans-serif";

export interface LandingProps {
  eyebrow: string;
  headline: string;
  accentWord: string;
  subhead: string;
  ctaLabel: string;
  featuresHeading: string;
  features: Array<{ title: string; body: string }>;
  stats: Array<{ value: string; label: string }>;
  quote: string;
  quoteAuthor: string;
  closingHeadline: string;
  closingCta: string;
}

/** The landing page as a plain React component — rendered directly from parsed props. */
export function LandingPageView(p: LandingProps) {
  {
    const hp = p.accentWord && p.headline.includes(p.accentWord)
      ? p.headline.split(p.accentWord)
      : [p.headline];
    return (
      <div style={{ font, fontFamily: font, color: "#141413", border: "1px solid #ece9e6", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        {/* Hero */}
        <section style={{ padding: "56px 48px 48px", background: "linear-gradient(180deg,#faf9f7,#fff)" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#887c71", fontWeight: 600 }}>{p.eyebrow}</div>
          <h1 style={{ fontSize: 46, lineHeight: 1.05, letterSpacing: "-0.03em", fontWeight: 500, margin: "16px 0 0", maxWidth: 640 }}>
            {hp[0]}
            {hp.length > 1 && <em style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400 }}>{p.accentWord}</em>}
            {hp[1]}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: "rgba(20,20,19,0.6)", margin: "18px 0 26px", maxWidth: 520 }}>{p.subhead}</p>
          <button style={{ background: "#141413", color: "#fff", border: "none", borderRadius: 13, padding: "14px 28px", fontSize: 15.5, fontWeight: 600 }}>{p.ctaLabel}</button>
        </section>

        {/* Features */}
        <section style={{ padding: "44px 48px", borderTop: "1px solid #ece9e6" }}>
          <h2 style={{ fontSize: 27, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 24px" }}>{p.featuresHeading}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 18 }}>
            {p.features.map((f, i) => (
              <div key={i} style={{ background: "#faf9f7", borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#141413", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, marginBottom: 12 }}>{i + 1}</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 5 }}>{f.title}</div>
                <div style={{ color: "rgba(20,20,19,0.6)", fontSize: 13.5, lineHeight: 1.5 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: "36px 48px", background: "#141413", color: "#fff", display: "flex", gap: 44, flexWrap: "wrap" }}>
          {p.stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13.5, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* Quote */}
        <section style={{ padding: "48px", borderTop: "1px solid #ece9e6" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 26, lineHeight: 1.35, margin: 0, maxWidth: 700 }}>“{p.quote}”</p>
          <div style={{ color: "rgba(20,20,19,0.5)", fontSize: 14.5, marginTop: 16 }}>{p.quoteAuthor}</div>
        </section>

        {/* CTA */}
        <section style={{ padding: "52px 48px", textAlign: "center", background: "linear-gradient(180deg,#fff,#faf9f7)", borderTop: "1px solid #ece9e6" }}>
          <h2 style={{ fontSize: 31, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 20px" }}>{p.closingHeadline}</h2>
          <button style={{ background: "#141413", color: "#fff", border: "none", borderRadius: 13, padding: "14px 32px", fontSize: 15.5, fontWeight: 600 }}>{p.closingCta}</button>
        </section>
      </div>
    );
  }
}

const landingProps = z.object({
  eyebrow: z.string().describe("Small uppercase kicker above the headline (brand or category)"),
  headline: z.string().describe("Main hero headline"),
  accentWord: z.string().describe("A short phrase that appears inside headline to italic-accent; or empty"),
  subhead: z.string().describe("One or two sentence supporting line under the headline"),
  ctaLabel: z.string().describe("Primary hero button text, e.g. 'Pre-order — $129'"),
  featuresHeading: z.string().describe("Heading for the features section"),
  features: z.array(z.object({ title: z.string(), body: z.string().describe("one sentence") })).describe("3 or 4 product features"),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).describe("2 to 4 traction/impact metrics"),
  quote: z.string().describe("A testimonial quote"),
  quoteAuthor: z.string().describe("Name, role of the testimonial author"),
  closingHeadline: z.string().describe("Closing call-to-action headline"),
  closingCta: z.string().describe("Closing button text"),
});

// Registered so the agent emits valid OpenUI Lang and we can parse/validate it.
const LandingPage = defineComponent({
  name: "LandingPage",
  description:
    "A complete, polished product launch page. Fill every field with real, specific, premium marketing copy for the product in the brief. Emit exactly one LandingPage call.",
  props: landingProps,
  component: LandingPageView,
});

export const landingLibrary = createLibrary({ components: [LandingPage], root: "LandingPage" });

/** Parse agent OpenUI Lang -> resolved LandingProps (renders via LandingPageView). */
export function parseLanding(openuiLang: string): LandingProps | null {
  const r = createParser(landingLibrary.toJSONSchema()).parse(openuiLang);
  const props = (r.root as { props?: LandingProps } | null)?.props;
  return props && props.headline ? props : null;
}

export const LANDING_SYSTEM_PROMPT = landingLibrary.prompt({
  preamble:
    "You are a senior product designer and copywriter. Given a product brief, design a complete launch page by emitting EXACTLY ONE LandingPage(...) call with every field filled. Write real, specific, premium marketing copy — invent plausible features, metrics, and a testimonial that fit the product. Pick an evocative accentWord that actually appears inside the headline. No lorem ipsum, no filler.",
});
