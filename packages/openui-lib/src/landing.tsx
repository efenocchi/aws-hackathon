/**
 * OpenUI (sponsor) — landing-page component library. This is the flagship
 * deliverable surface: a seller agent designs a real, polished launch page for
 * the buyer's product by emitting OpenUI Lang against these components, which
 * the storefront renders live with <Renderer>. No image/video spend — the
 * "creative" is generative UI.
 */
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";

const wrap: React.CSSProperties = {
  fontFamily: "'Inter Tight', -apple-system, sans-serif",
  color: "#141413",
};

const Hero = defineComponent({
  name: "Hero",
  description:
    "Top hero band: big headline (use accentWord to italic-accent one phrase), a subheadline, and a primary call-to-action button. The launch's first impression.",
  props: z.object({
    eyebrow: z.string().describe("Small uppercase label above the headline, e.g. the brand or category"),
    headline: z.string().describe("Main headline"),
    accentWord: z.string().describe("A short phrase inside the headline to render in serif italic; leave empty to skip"),
    subhead: z.string().describe("One or two sentence supporting line"),
    ctaLabel: z.string().describe("Primary button text"),
  }),
  component: ({ eyebrow, headline, accentWord, subhead, ctaLabel }) => {
    const parts = accentWord && headline.includes(accentWord)
      ? headline.split(accentWord)
      : [headline];
    return (
      <section style={{ ...wrap, padding: "64px 56px 56px", background: "linear-gradient(180deg,#faf9f7,#fff)" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#887c71", fontWeight: 600 }}>{eyebrow}</div>
        <h1 style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: "-0.03em", fontWeight: 500, margin: "18px 0 0", maxWidth: 720 }}>
          {parts[0]}
          {parts.length > 1 && <em style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400 }}>{accentWord}</em>}
          {parts[1]}
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.5, color: "rgba(20,20,19,0.6)", margin: "20px 0 28px", maxWidth: 560 }}>{subhead}</p>
        <button style={{ background: "#141413", color: "#fff", border: "none", borderRadius: 14, padding: "15px 30px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{ctaLabel}</button>
      </section>
    );
  },
});

const FeatureGrid = defineComponent({
  name: "FeatureGrid",
  description: "A grid of 3-4 product features, each a short title + one-line description.",
  props: z.object({
    heading: z.string().describe("Section heading"),
    features: z.array(z.object({
      title: z.string(),
      body: z.string().describe("One sentence"),
    })).describe("3 or 4 features"),
  }),
  component: ({ heading, features }) => (
    <section style={{ ...wrap, padding: "48px 56px", borderTop: "1px solid #ece9e6" }}>
      <h2 style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 28px" }}>{heading}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 22 }}>
        {features.map((f, i) => (
          <div key={i} style={{ background: "#faf9f7", borderRadius: 18, padding: "22px 24px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#141413", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, marginBottom: 14 }}>{i + 1}</div>
            <div style={{ fontWeight: 600, fontSize: 16.5, marginBottom: 6 }}>{f.title}</div>
            <div style={{ color: "rgba(20,20,19,0.6)", fontSize: 14, lineHeight: 1.5 }}>{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  ),
});

const StatBar = defineComponent({
  name: "StatBar",
  description: "A row of 2-4 headline metrics (big number + label). Use for traction/impact figures.",
  props: z.object({
    stats: z.array(z.object({
      value: z.string().describe("The number, e.g. '57%' or '$2'"),
      label: z.string().describe("What it measures"),
    })).describe("2 to 4 stats"),
  }),
  component: ({ stats }) => (
    <section style={{ ...wrap, padding: "40px 56px", background: "#141413", color: "#fff", display: "flex", gap: 48, flexWrap: "wrap" }}>
      {stats.map((s, i) => (
        <div key={i}>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.value}</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </section>
  ),
});

const Quote = defineComponent({
  name: "Quote",
  description: "A single testimonial quote with attribution.",
  props: z.object({
    text: z.string().describe("The quote"),
    author: z.string().describe("Name, role"),
  }),
  component: ({ text, author }) => (
    <section style={{ ...wrap, padding: "52px 56px", borderTop: "1px solid #ece9e6" }}>
      <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.35, letterSpacing: "-0.01em", margin: 0, maxWidth: 760 }}>“{text}”</p>
      <div style={{ color: "rgba(20,20,19,0.5)", fontSize: 15, marginTop: 18 }}>{author}</div>
    </section>
  ),
});

const CTA = defineComponent({
  name: "CTA",
  description: "Closing call-to-action band with a headline and button.",
  props: z.object({
    headline: z.string(),
    buttonLabel: z.string(),
  }),
  component: ({ headline, buttonLabel }) => (
    <section style={{ ...wrap, padding: "56px", textAlign: "center", background: "linear-gradient(180deg,#fff,#faf9f7)", borderTop: "1px solid #ece9e6" }}>
      <h2 style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 22px" }}>{headline}</h2>
      <button style={{ background: "#141413", color: "#fff", border: "none", borderRadius: 14, padding: "15px 34px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{buttonLabel}</button>
    </section>
  ),
});

const LandingPage = defineComponent({
  name: "LandingPage",
  description:
    "Root container for the whole launch page. Compose it from a Hero, then any mix of FeatureGrid / StatBar / Quote, ending with a CTA. Pass the sections as children in order.",
  props: z.object({
    sections: z.array(z.any()).describe("The page sections in order (Hero first, CTA last)"),
  }),
  component: ({ sections }) => (
    <div style={{ ...wrap, border: "1px solid #ece9e6", borderRadius: 18, overflow: "hidden", background: "#fff" }}>
      {sections}
    </div>
  ),
});

export const landingLibrary = createLibrary({
  components: [LandingPage, Hero, FeatureGrid, StatBar, Quote, CTA],
  root: "LandingPage",
});

export const LANDING_SYSTEM_PROMPT = landingLibrary.prompt({
  preamble:
    "You are a senior product designer and copywriter. Given a product brief, design a complete, polished launch landing page. Write real, specific, confident marketing copy — invent plausible features, metrics, and a testimonial that fit the product. Compose: root = LandingPage with a sections array that ALWAYS starts with a Hero, includes a FeatureGrid and a StatBar and a Quote in a sensible order, and ends with a CTA. Use the accentWord to italicize one evocative phrase in the hero headline. Keep copy tight and premium — no filler, no lorem ipsum.",
});
