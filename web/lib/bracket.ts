import type { MatchupCell, Matchups } from "./matchups";
import type { Results } from "./types";

// R32 slot mapping mirrors src/wc2026/data/tournament.py.
// Each slot is "1X" (group winner), "2X" (group runner-up), or "3-XYZW".
const R32_SLOTS: Array<[string, string]> = [
  ["1A", "3-CDEF"],
  ["1C", "3-ABFH"],
  ["1B", "2F"],
  ["1E", "3-ABDF"],
  ["1G", "3-ABCD"],
  ["1H", "2L"],
  ["1I", "3-CDEH"],
  ["1K", "3-ABEJ"],
  ["1F", "3-EHIJ"],
  ["1J", "3-FGHI"],
  ["1D", "2H"],
  ["1L", "2B"],
  ["2A", "2C"],
  ["2D", "2E"],
  ["2I", "2J"],
  ["2G", "2K"],
];

export type BracketMatch = {
  stage: "R32" | "R16" | "QF" | "SF" | "Final";
  team_a: string;
  team_b: string;
  prob_a: number;          // pairwise P(team_a wins) at neutral venue
  prob_b: number;          // pairwise P(team_b wins) at neutral venue
  prob_draw: number;       // pairwise P(draw)
  prob_winner: number;     // pairwise P(winner wins) — equals prob_a or prob_b
  winner: string;
  cell: MatchupCell;
};

// At each stage, the winner of a match is the team with the higher
// probability of advancing to the NEXT stage in the full Monte Carlo. This
// makes the modal bracket end with the actual most-likely champion (e.g.
// Brazil at 16.1%) rather than the head-to-head favorite of every individual
// pairing. The pairwise win-probability shown for each match still reflects
// the model's matchup assessment.
const NEXT_STAGE_KEY: Record<BracketMatch["stage"], keyof Results["probabilities"]> = {
  R32: "round_of_16",
  R16: "quarterfinal",
  QF: "semifinal",
  SF: "final",
  Final: "champion",
};

function topTeamForRank(group: string[], probs: Record<string, number>): string {
  return group.reduce((best, t) => (probs[t] > probs[best] ? t : best), group[0]);
}

function lookupCell(m: Matchups, a: string, b: string): MatchupCell {
  return m.matchups[`${a}|${b}`] ?? m.matchups[`${b}|${a}`] ?? {
    p_a: 0.5, p_d: 0, p_b: 0.5, ea: 0, eb: 0, top_score: "0-0",
  };
}

export function buildModalBracket(r: Results, mu: Matchups): BracketMatch[] {
  // 1. Group winners + runners-up = single canonical pick per slot
  const groupWinner: Record<string, string> = {};
  const groupRunner: Record<string, string> = {};
  for (const [letter, teams] of Object.entries(r.groups)) {
    groupWinner[letter] = topTeamForRank(teams, r.probabilities.group_winner);
    groupRunner[letter] = topTeamForRank(
      teams.filter((t) => t !== groupWinner[letter]),
      r.probabilities.group_runner_up,
    );
  }

  // 2. Best 8 third-placed groups (by group_third_advancing of their 3rd team)
  const thirdsByGroup = Object.entries(r.groups).map(([letter, teams]) => {
    const third = teams.reduce((best, t) =>
      (r.probabilities.group_third_advancing[t] ?? 0) >
      (r.probabilities.group_third_advancing[best] ?? 0)
        ? t
        : best,
      teams[0]);
    return {
      letter,
      team: third,
      score: r.probabilities.group_third_advancing[third] ?? 0,
    };
  });
  const advancing = new Set(
    thirdsByGroup.sort((a, b) => b.score - a.score).slice(0, 8).map((t) => t.letter),
  );
  const thirdTeam: Record<string, string> = Object.fromEntries(
    thirdsByGroup.map((t) => [t.letter, t.team]),
  );

  // 3. Bipartite-match the 8 advancing third-placed groups to the 8 R32
  //    third-slots so each group lands in exactly one compatible slot.
  //    Without this, multiple slots greedily picked the same group's third
  //    (e.g. Czech Republic showing up in 5 R32 matches).
  const thirdSlots: string[] = [];
  for (const [a, b] of R32_SLOTS) {
    if (a.startsWith("3-")) thirdSlots.push(a);
    if (b.startsWith("3-")) thirdSlots.push(b);
  }
  const remaining = [...advancing].sort();
  const slotsLeft = [...thirdSlots];
  const slotForGroup: Record<string, string> = {};
  for (const g of remaining) {
    let placed = false;
    for (let i = 0; i < slotsLeft.length; i++) {
      const eligible = slotsLeft[i].slice(2);
      if (eligible.includes(g)) {
        slotForGroup[g] = slotsLeft[i];
        slotsLeft.splice(i, 1);
        placed = true;
        break;
      }
    }
    if (!placed && slotsLeft.length > 0) {
      // Compatibility fallback — relax constraint to keep the assignment total.
      slotForGroup[g] = slotsLeft.shift()!;
    }
  }
  // Invert: which group's third is in each slot?
  const groupForSlot: Record<string, string> = {};
  for (const [g, slot] of Object.entries(slotForGroup)) groupForSlot[slot] = g;

  const resolveSlot = (slot: string): string => {
    if (slot.startsWith("3-")) {
      const g = groupForSlot[slot];
      if (g) return thirdTeam[g];
      // Slot without an assignment (no advancing group fits) — fallback to the
      // best-rated third in the eligibility set.
      const eligibleGroups = slot.slice(2).split("");
      const pick = eligibleGroups[0];
      return thirdTeam[pick];
    }
    const rank = slot[0]; // "1" or "2"
    const group = slot[1];
    return rank === "1" ? groupWinner[group] : groupRunner[group];
  };

  let teams = R32_SLOTS.map(([a, b]) => [resolveSlot(a), resolveSlot(b)] as [string, string]);
  const matches: BracketMatch[] = [];
  const stages: BracketMatch["stage"][] = ["R32", "R16", "QF", "SF", "Final"];

  for (const stage of stages) {
    const winners: string[] = [];
    const stageProbs = r.probabilities[NEXT_STAGE_KEY[stage]];
    for (const [a, b] of teams) {
      const cell = lookupCell(mu, a, b);
      // Pick the winner by their probability of advancing to the next stage in
      // the full simulation, not by head-to-head pairwise alone. This makes
      // the modal bracket land on the actual most-likely champion.
      const probA_next = stageProbs[a] ?? 0;
      const probB_next = stageProbs[b] ?? 0;
      const winner = probA_next >= probB_next ? a : b;
      const prob_winner = winner === a ? cell.p_a : cell.p_b;
      matches.push({
        stage,
        team_a: a,
        team_b: b,
        prob_a: cell.p_a,
        prob_b: cell.p_b,
        prob_draw: cell.p_d,
        prob_winner,
        winner,
        cell,
      });
      winners.push(winner);
    }
    if (winners.length <= 1) break;
    teams = [];
    for (let i = 0; i < winners.length; i += 2) teams.push([winners[i], winners[i + 1]]);
  }

  return matches;
}
