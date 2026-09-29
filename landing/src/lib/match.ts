/**
 * Client-side copy of the match index formula for the landing demo — the
 * same rules as backend/app/match_score.py (unit-tested there):
 *   index = Σ weight × credit / Σ weight; weight 2 (core) / 1 (nice-to-have);
 *   credit 1 verified by the university, 0.75 «на усмотрение работодателя»,
 *   0.5 claimed by the student, 0.5 / 0.25 adjacent verified / claimed skill, 0 missing.
 */
export type SkillState = "claimed" | "employer" | "verified";
export type Status = SkillState | "related" | "missing";
export interface Requirement { skill: string; core: boolean }
export interface Item extends Requirement { status: Status; credit: number; via?: string }

const CREDIT = { verified: 1, employer: 0.75, claimed: 0.5, related: 0.5, relatedClaimed: 0.25 };

export function computeMatch(requirements: Requirement[], student: Record<string, SkillState>, families: Record<string, string>) {
  const verifiedFam = new Map<string, string>();
  const otherFam = new Map<string, string>();
  Object.entries(student).forEach(([skill, state]) => {
    const f = families[skill];
    if (!f) return;
    const target = state === "verified" ? verifiedFam : otherFam;
    if (!target.has(f)) target.set(f, skill);
  });
  const items: Item[] = requirements.map((r) => {
    const own = student[r.skill];
    if (own) return { ...r, status: own, credit: CREDIT[own] };
    const f = families[r.skill];
    if (f && verifiedFam.has(f)) return { ...r, status: "related", credit: CREDIT.related, via: verifiedFam.get(f) };
    if (f && otherFam.has(f)) return { ...r, status: "related", credit: CREDIT.relatedClaimed, via: otherFam.get(f) };
    return { ...r, status: "missing", credit: 0 };
  });
  const weight = (i: Item) => (i.core ? 2 : 1);
  const total = items.reduce((s, i) => s + weight(i), 0);
  const pct = (fn: (i: Item) => number) => (total ? Math.round((items.reduce((s, i) => s + weight(i) * fn(i), 0) / total) * 1000) / 10 : 0);
  const score = pct((i) => i.credit);
  const verifiedScore = pct((i) => (i.status === "verified" ? 1 : i.status === "related" && i.via && student[i.via] === "verified" ? CREDIT.related : 0));
  return { score, verifiedScore, items };
}
