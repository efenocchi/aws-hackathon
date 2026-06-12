import Anthropic from "@anthropic-ai/sdk";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { CONFIG } from "./config.js";

export interface Storyboard {
  concept: string;
  tagline: string;
  shots: Array<{
    title: string;
    /** Prompt for the keyframe image model. */
    imagePrompt: string;
    /** Motion/camera prompt for the image-to-video model. */
    motionPrompt: string;
  }>;
}

const SYSTEM = `You are an award-winning commercial director creating short promo videos.
Given a brief, produce a storyboard for a ~25-30 second spot as strict JSON:
{"concept": "...", "tagline": "...", "shots": [{"title": "...", "imagePrompt": "...", "motionPrompt": "..."}]}

Rules:
- Exactly the requested number of shots, each ~5 seconds.
- imagePrompt: a complete standalone prompt for a diffusion image model — subject, environment, lighting, lens, mood, style. Keep a consistent visual identity (palette, lighting language, recurring motifs) across ALL shots so the spot feels like one film.
- motionPrompt: camera movement + subject motion for an image-to-video model (e.g. "slow dolly-in, particles drift upward, light blooms").
- Cinematic, premium, modern. No text overlays in prompts (we add typography in post).
- Return ONLY the JSON object, no markdown fences.`;

/** Asks Claude (Fable 5) for a storyboard. */
export async function directStoryboard(
  brief: string,
  shotCount: number,
): Promise<Storyboard> {
  const raw = await complete(SYSTEM, `Brief: ${brief}\nShots: ${shotCount}`);
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const board = JSON.parse(json) as Storyboard;
  if (!board.shots?.length) throw new Error("director returned no shots");
  return board;
}

/**
 * Generic completion. FREE-FIRST priority: Claude Code CLI (user's subscription,
 * zero key spend) -> Anthropic API -> TrueFoundry -> Bedrock. Force a specific
 * provider with DIRECTOR_PROVIDER=claude-code|anthropic|truefoundry|bedrock.
 */
export async function complete(system: string, user: string): Promise<string> {
  const forced = process.env.DIRECTOR_PROVIDER;
  if (forced === "anthropic") return viaAnthropic(user, system);
  if (forced === "truefoundry") return viaTrueFoundry(user, system);
  if (forced === "bedrock") return viaBedrock(user, system);
  if (forced === "claude-code") return viaClaudeCode(user, system);
  if (await claudeCliAvailable()) return viaClaudeCode(user, system);
  if (process.env.ANTHROPIC_API_KEY) return viaAnthropic(user, system);
  if (CONFIG.director.truefoundryApiKey) return viaTrueFoundry(user, system);
  return viaBedrock(user, system);
}

let cliAvailable: boolean | null = null;
async function claudeCliAvailable(): Promise<boolean> {
  if (cliAvailable !== null) return cliAvailable;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  cliAvailable = await promisify(execFile)("claude", ["--version"])
    .then(() => true)
    .catch(() => false);
  return cliAvailable;
}

/** Headless Claude Code (`claude -p`) on the user's logged-in account — no API key. */
async function viaClaudeCode(user: string, system: string = SYSTEM): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)(
    "claude",
    ["-p", user, "--append-system-prompt", system, "--max-turns", "3"],
    { maxBuffer: 10 * 1024 * 1024, timeout: 180_000 },
  );
  const text = stdout.trim();
  if (!text) throw new Error("empty Claude Code response");
  return text;
}

async function viaAnthropic(user: string, system: string = SYSTEM): Promise<string> {
  const client = new Anthropic();
  const res = await client.messages.create({
    // Fable 5: thinking always on (omit the param), no sampling params accepted.
    model: process.env.ANTHROPIC_MODEL ?? "claude-fable-5",
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("director refused the brief");
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("empty Anthropic response");
  return text;
}

async function viaBedrock(user: string, system: string = SYSTEM): Promise<string> {
  const client = new BedrockRuntimeClient({ region: CONFIG.director.region });
  const res = await client.send(
    new ConverseCommand({
      modelId: CONFIG.director.bedrockModelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.8 },
    }),
  );
  const text = res.output?.message?.content?.find((c) => "text" in c)?.text;
  if (!text) throw new Error("empty Bedrock response");
  return text;
}

async function viaTrueFoundry(user: string, system: string = SYSTEM): Promise<string> {
  const res = await fetch(`${CONFIG.director.truefoundryBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.director.truefoundryApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.director.truefoundryModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`TrueFoundry ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}
