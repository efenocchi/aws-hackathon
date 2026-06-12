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

let citeablesPublisherId: string | null = null;
async function getCiteablesPublisher(): Promise<string> {
  if (citeablesPublisherId) return citeablesPublisherId;
  const { destinations } = await senso<{
    destinations: Array<{ publisher_id: string; slug: string }>;
  }>("/org/destinations");
  const dest = destinations.find((d) => d.slug === "citeables") ?? destinations[0];
  if (!dest) throw new Error("no citeables destination");
  citeablesPublisherId = dest.publisher_id;
  return citeablesPublisherId;
}

/**
 * Publishes a deliverable to cited.md (citeables). Verified against the live
 * Senso Org API 2026-06-12: create a prompt -> publish markdown against it.
 */
export async function publishToCited(input: PublishInput): Promise<PublishResult> {
  const publisherId = await getCiteablesPublisher();
  const prompt = await senso<{ prompt_id: string }>("/org/prompts", {
    method: "POST",
    body: JSON.stringify({ question_text: input.title, type: "awareness" }),
  });
  const questionId = prompt.prompt_id;
  if (!questionId) throw new Error(`no prompt_id in response: ${JSON.stringify(prompt)}`);

  const response = await senso("/org/content-engine/publish", {
    method: "POST",
    body: JSON.stringify({
      geo_question_id: questionId,
      raw_markdown: input.markdown,
      seo_title: input.title,
      summary: input.summary,
      publisher_ids: [publisherId],
      mark_as_published: true,
    }),
  });
  return { questionId, response };
}
