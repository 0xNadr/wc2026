import { Skull } from "lucide-react";
import { getResults, pct, teamFlag } from "@/lib/data";

// Competitiveness = Shannon entropy over the 4 teams' "advance to R32"
// probabilities, normalized to [0, 1] (max entropy = log2(4) = 2 bits).
function competitiveness(advanceProbs: number[]): number {
  const total = advanceProbs.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const H = advanceProbs
    .map((p) => p / total)
    .filter((p) => p > 0)
    .reduce((acc, p) => acc - p * Math.log2(p), 0);
  return H / 2;
}

function competitivenessBadge(score: number) {
  if (score >= 0.95) return { label: "Group of Death", tone: "bg-live/15 text-live border-live/40" };
  if (score >= 0.88) return { label: "Very competitive", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40" };
  if (score >= 0.78) return { label: "Competitive", tone: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40" };
  if (score >= 0.65) return { label: "One favorite", tone: "bg-advance/15 text-advance border-advance/40" };
  return { label: "Walkover", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/40" };
}

// Flashscore-style left zone bar:
// 1st & 2nd auto-advance to R32 → green
// 3rd may advance (best four 3rd-place teams) → amber
// 4th eliminated → red
function zoneBarClass(rank: number): string {
  if (rank <= 2) return "before:bg-advance";
  if (rank === 3) return "before:bg-amber-500";
  return "before:bg-eliminate";
}

export default async function GroupsPage() {
  const r = await getResults();
  const groupLetters = Object.keys(r.groups).sort();

  const groups = groupLetters
    .map((letter) => {
      const teams = r.groups[letter];
      const ranked = teams
        .map((t) => {
          const win = r.probabilities.group_winner[t] ?? 0;
          const ru = r.probabilities.group_runner_up[t] ?? 0;
          const third = r.probabilities.group_third_advancing[t] ?? 0;
          const out = r.probabilities.group_eliminated[t] ?? 0;
          return { team: t, win, ru, third, out, advance: win + ru + third };
        })
        .sort((a, b) => b.advance - a.advance);
      const competitivenessScore = competitiveness(ranked.map((x) => x.advance));
      return { letter, teams, ranked, competitivenessScore };
    })
    .sort((a, b) => b.competitivenessScore - a.competitivenessScore);

  const groupOfDeath = groups[0];

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Group stage</h1>
        <p className="text-sm text-muted-foreground">
          Probability each team finishes in its group's top 2 (auto-advance), advances as one of 8
          best third-placed teams, or is eliminated. Based on{" "}
          <span className="font-mono text-foreground">{r.n_simulations.toLocaleString()}</span>{" "}
          simulated tournaments.
        </p>
      </section>

      {/* Group of Death banner — Flashscore-style: thin colored top stripe, dense info row */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="flex items-center justify-between bg-live/10 border-b border-live/30 px-3 py-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-live flex items-center gap-2">
            <Skull className="w-4 h-4" />
            Group of Death — Group {groupOfDeath.letter}
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            competitiveness {(groupOfDeath.competitivenessScore * 100).toFixed(0)} / 100
          </span>
        </div>
        <div className="px-3 py-3 text-sm">
          <p className="text-muted-foreground mb-3">
            Most competitive group — entropy of advance-probability distribution closest to uniform.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {groupOfDeath.ranked.map((t) => (
              <span
                key={t.team}
                className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-sm px-2 py-1 text-xs"
              >
                <span className="text-sm leading-none">{teamFlag(t.team)}</span>
                <span className="font-medium">{t.team}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {pct(t.advance, 0)}
                </span>
              </span>
            ))}
          </div>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              All groups ranked by competitiveness
            </summary>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 font-mono tabular-nums">
              {groups.map((g) => (
                <li key={g.letter} className="flex justify-between">
                  <span>Group {g.letter}</span>
                  <span>{(g.competitivenessScore * 100).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      {/* Group cards — standings-style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groupLetters.map((letter) => {
          const g = groups.find((x) => x.letter === letter)!;
          const badge = competitivenessBadge(g.competitivenessScore);
          return (
            <div key={letter} className="bg-card border border-border rounded-sm overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-3 py-1.5 border-b border-border">
                <h3 className="flex items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Group
                  </span>
                  <span className="text-base font-bold">{letter}</span>
                </h3>
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-sm border ${badge.tone}`}
                >
                  {badge.label}
                </span>
              </div>

              <ul>
                {g.ranked.map((t, idx) => {
                  const rank = idx + 1;
                  return (
                    <li
                      key={t.team}
                      className={`relative grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-2 px-3 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${zoneBarClass(
                        rank,
                      )}`}
                    >
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground text-center">
                        {rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base shrink-0 leading-none">
                            {teamFlag(t.team)}
                          </span>
                          <span className="text-sm font-medium truncate">{t.team}</span>
                        </div>
                        <div
                          className="flex h-1.5 rounded-sm overflow-hidden bg-muted/60"
                          title={`Win ${pct(t.win)} · Runner-up ${pct(t.ru)} · 3rd-advancing ${pct(t.third)}`}
                        >
                          <div className="bg-advance" style={{ width: `${t.win * 100}%` }} />
                          <div className="bg-advance/60" style={{ width: `${t.ru * 100}%` }} />
                          <div className="bg-amber-400" style={{ width: `${t.third * 100}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono tabular-nums font-semibold">
                          {pct(t.advance, 0)}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                          advance
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-center gap-3 px-3 py-1.5 border-t border-border bg-muted/40 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-advance" />1st
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-advance/60" />2nd
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-400" />3rd-adv
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
