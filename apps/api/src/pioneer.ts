/**
 * Pioneer (Fastino) — adaptive inference that fine-tunes on your traffic.
 * The copywriter skill routes through Pioneer's OpenAI-compatible endpoint:
 * every launch-copy job becomes training signal, enacting "the inference API
 * that improves with your traffic". No-ops without PIONEER_API_KEY.
 */

const BASE = process.env.PIONEER_BASE_URL ?? "https://api.pioneer.ai/v1";

export function pioneerEnabled(): boolean {
  // Spend gate: a key in .env alone must not trigger paid calls (team policy —
  // no paid API usage without explicit approval).
  return Boolean(process.env.PIONEER_API_KEY) && process.env.PIONEER_SPEND_APPROVED === "1";
}

export async function pioneerComplete(system: string, user: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.PIONEER_API_KEY!,
    },
    body: JSON.stringify({
      model: process.env.PIONEER_MODEL ?? "pioneer/auto",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`pioneer ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}
