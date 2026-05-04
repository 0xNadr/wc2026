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
  prob_a: number;
  winner: string;
  cell: MatchupCell;
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

  // 3. Resolve R32 slots
  const resolveSlot = (slot: string): string => {
    if (slot.startsWith("3-")) {
      const eligibleGroups = slot.slice(2).split("");
      const advancingFromHere = eligibleGroups.filter((g) => advancing.has(g));
      const pick = advancingFromHere[0] ?? eligibleGroups[0];
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
    for (const [a, b] of teams) {
      const cell = lookupCell(mu, a, b);
      const winner = cell.p_a >= cell.p_b ? a : b;
      matches.push({ stage, team_a: a, team_b: b, prob_a: cell.p_a, winner, cell });
      winners.push(winner);
    }
    if (winners.length <= 1) break;
    teams = [];
    for (let i = 0; i < winners.length; i += 2) teams.push([winners[i], winners[i + 1]]);
  }

  return matches;
}
