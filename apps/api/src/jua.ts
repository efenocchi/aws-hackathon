/**
 * Jua AI (Earth simulation foundation model) — point forecasts feed the
 * "weather-smart promo" skill: real conditions at the launch location get
 * woven into the creative brief. No-ops without JUA_API_KEY ("ID:SECRET").
 */

const BASE = "https://query.jua.ai/v1";

export interface ForecastSummary {
  location: string;
  summary: string;
}

export async function pointForecast(lat: number, lon: number, label: string): Promise<ForecastSummary> {
  const key = process.env.JUA_API_KEY;
  if (!key) throw new Error("JUA_API_KEY not set");
  const res = await fetch(
    `${BASE}/forecast/?latitude=${lat}&longitude=${lon}`,
    { headers: { "X-API-Key": key } },
  );
  if (!res.ok) throw new Error(`jua ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Schema confirmed at runtime — keep the raw payload compact for the director.
  return { location: label, summary: JSON.stringify(data).slice(0, 2000) };
}

/** Rough geocode for demo cities so the skill works from a plain city name. */
export const DEMO_CITIES: Record<string, [number, number]> = {
  "san francisco": [37.7749, -122.4194],
  "new york": [40.7128, -74.006],
  london: [51.5074, -0.1278],
  paris: [48.8566, 2.3522],
  tokyo: [35.6762, 139.6503],
  yerevan: [40.1792, 44.4991],
};
