/**
 * Deterministic skill selection — no LLM, no API keys.
 * Score = keyword overlap between the goal and the listing (category > tags >
 * name > description), then rating desc, price asc, id asc as tiebreaks.
 */
import type { SkillListing } from "@aas/contracts";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "our", "your",
  "her", "his", "its", "their", "about", "make", "made", "get", "got", "want",
  "need", "please", "can", "you", "run", "use",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Loose stem match so "scheduling" hits "scheduler", "promos" hits "promo". */
function matches(token: string, word: string): boolean {
  return (
    token === word ||
    (token.length > 3 && word.startsWith(token.slice(0, 4))) ||
    (word.length > 3 && token.startsWith(word.slice(0, 4)))
  );
}

function overlap(tokens: string[], words: string[]): number {
  return tokens.filter((t) => words.some((w) => matches(t, w))).length;
}

export interface RankedSkill {
  skill: SkillListing;
  score: number;
}

export function rankSkills(goal: string, skills: SkillListing[]): RankedSkill[] {
  const tokens = tokenize(goal);
  return skills
    .map((skill) => ({
      skill,
      score:
        4 * overlap(tokens, [skill.category]) +
        3 * overlap(tokens, skill.tags.flatMap(tokenize)) +
        2 * overlap(tokens, tokenize(skill.name)) +
        1 * overlap(tokens, tokenize(skill.description)),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.skill.rating - a.skill.rating ||
        a.skill.priceUsd - b.skill.priceUsd ||
        a.skill.id.localeCompare(b.skill.id),
    );
}
