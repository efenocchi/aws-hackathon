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
 * Generic completion. Provider priority: Anthropic API (sponsor, Fable 5) ->
 * TrueFoundry gateway (sponsor) -> Bedrock (local AWS creds fallback).
 */
export async function complete(system: string, user: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return viaAnthropic(user, system);
  if (CONFIG.director.truefoundryApiKey) return viaTrueFoundry(user, system);
  return viaBedrock(user, system);
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
