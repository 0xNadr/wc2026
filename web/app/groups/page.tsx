import { Skull } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getResults, pct, teamFlag } from "@/lib/data";

// Competitiveness = Shannon entropy over the 4 teams' "advance to R32"
// probabilities, normalized to [0, 1] (max entropy = log2(4) = 2 bits).
// 1.0 = all four equally likely to advance (true Group of Death).
// 0.0 = one team a lock, others have zero chance.
function competitiveness(advanceProbs: number[]): number {
  const total = advanceProbs.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const H = advanceProbs
    .map((p) => p / total)
    .filter((p) => p > 0)
    .reduce((acc, p) => acc - p * Math.log2(p), 0);
  return H / 2; // max entropy on 4 classes = 2 bits
}

function competitivenessBadge(score: number) {
  if (score >= 0.95) return { label: "Group of Death", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
  if (score >= 0.88) return { label: "Very competitive", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  if (score >= 0.78) return { label: "Competitive", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" };
  if (score >= 0.65) return { label: "One favorite", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  return { label: "Walkover", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" };
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
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Group stage</h1>
        <p className="text-muted-foreground">
          Probability each team finishes in its group's top 2 (auto-advance), advances as one of 8
          best third-placed teams, or is eliminated. Based on{" "}
          <span className="font-mono">{r.n_simulations.toLocaleString()}</span> simulated
          tournaments.
        </p>
      </section>

      <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <Skull className="w-5 h-5 text-rose-400" />
              Group of Death
            </span>
            <Badge variant="outline" className="text-xs">
              competitiveness {(groupOfDeath.competitivenessScore * 100).toFixed(0)} / 100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-2">
            Group <span className="font-bold text-foreground">{groupOfDeath.letter}</span> is the
            most competitive. Entropy of its advance probability distribution is closest to
            uniform.
          </p>
          <div className="flex flex-wrap gap-2">
            {groupOfDeath.ranked.map((t) => (
              <Badge key={t.team} variant="secondary" className="text-sm">
                <span className="mr-1">{teamFlag(t.team)}</span>
                {t.team}{" "}
                <span className="ml-2 font-mono text-muted-foreground">{pct(t.advance, 0)}</span>
              </Badge>
            ))}
          </div>
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              See all groups ranked by competitiveness
            </summary>
            <ul className="mt-2 space-y-1 font-mono tabular-nums">
              {groups.map((g) => (
                <li key={g.letter} className="flex justify-between max-w-xs">
                  <span>Group {g.letter}</span>
                  <span>{(g.competitivenessScore * 100).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupLetters.map((letter) => {
          const g = groups.find((x) => x.letter === letter)!;
          const badge = competitivenessBadge(g.competitivenessScore);
          return (
            <Card key={letter}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Group</span>
                    <span className="text-2xl font-bold">{letter}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Standings table — scoreboard style */}
                <div className="space-y-1.5">
                  {g.ranked.map((t, rank) => {
                    const pos = rank + 1;
                    const posStyle =
                      pos === 1
                        ? "bg-emerald-500 text-white"
                        : pos === 2
                          ? "bg-emerald-400 text-white"
                          : pos === 3
                            ? "bg-amber-400 text-white"
                            : "bg-muted text-muted-foreground";
                    return (
                      <div
                        key={t.team}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 group/row"
                      >
                        <div className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center tabular-nums ${posStyle}`}>
                          {pos}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base shrink-0">{teamFlag(t.team)}</span>
                            <span className="text-sm font-medium truncate">{t.team}</span>
                          </div>
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/60">
                            <div
                              className="bg-emerald-500"
                              style={{ width: `${t.win * 100}%` }}
                              title={`Win group: ${pct(t.win)}`}
                            />
                            <div
                              className="bg-emerald-300"
                              style={{ width: `${t.ru * 100}%` }}
                              title={`Runner-up: ${pct(t.ru)}`}
                            />
                            <div
                              className="bg-amber-300"
                              style={{ width: `${t.third * 100}%` }}
                              title={`3rd advancing: ${pct(t.third)}`}
                            />
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
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-3 pt-3 mt-3 border-t border-border/40 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                    1st
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-300" />
                    2nd
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-300" />
                    3rd-adv
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
