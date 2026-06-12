/**
 * Thin client for the marketplace REST API (apps/api).
 * All calls go through the buyer's payment-aware fetch so MPP-gated routes
 * settle transparently.
 */
import type {
  ExecuteRequest,
  ExecuteResponse,
  JobStatus,
  SkillListing,
} from "@aas/contracts";

export class MarketClient {
  constructor(
    readonly baseUrl: string,
    private readonly fetchFn: typeof globalThis.fetch,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
    return JSON.parse(text) as T;
  }

  search(query?: string, category?: string): Promise<SkillListing[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    const qs = params.size ? `?${params}` : "";
    return this.request<SkillListing[]>(`/skills${qs}`);
  }

  skill(id: string): Promise<SkillListing> {
    return this.request<SkillListing>(`/skills/${encodeURIComponent(id)}`);
  }

  execute(id: string, body: ExecuteRequest): Promise<ExecuteResponse> {
    return this.request<ExecuteResponse>(
      `/skills/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  job(id: string): Promise<JobStatus> {
    return this.request<JobStatus>(`/jobs/${encodeURIComponent(id)}`);
  }
}
