/**
 * cited.md publishing via Senso's Org API (docs.senso.ai).
 * Flow: create a prompt (gives geo_question_id) -> publish markdown against it.
 * Requires SENSO_API_KEY (tgr_...). All endpoints verified against @senso-ai/cli v0.11.1.
 */

const BASE = "https://apiv2.senso.ai/api/v1";

async function senso<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.SENSO_API_KEY;
  if (!key) throw new Error("SENSO_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`senso ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export interface PublishInput {
  title: string;
  summary: string;
  markdown: string;
}

export interface PublishResult {
  questionId: string;
  response: unknown;
}

/**
 * Publishes a deliverable announcement to cited.md.
 * The exact prompts-create schema is thinly documented; if the shape below 400s,
 * check `senso prompts create --help` with the live CLI and adjust.
 */
export async function publishToCited(input: PublishInput): Promise<PublishResult> {
  const prompt = await senso<{ id?: string; question_id?: string }>(
    "/org/prompts",
    {
      method: "POST",
      body: JSON.stringify({ text: input.title }),
    },
  );
  const questionId = prompt.id ?? prompt.question_id;
  if (!questionId) throw new Error(`no question id in prompt response: ${JSON.stringify(prompt)}`);

  const response = await senso("/org/content-engine/publish", {
    method: "POST",
    body: JSON.stringify({
      geo_question_id: questionId,
      raw_markdown: input.markdown,
      seo_title: input.title,
      summary: input.summary,
      mark_as_published: true,
    }),
  });
  return { questionId, response };
}
