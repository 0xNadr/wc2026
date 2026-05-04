import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMatchups } from "@/lib/matchups";
import { getTeamMetas } from "@/lib/teams";
import { getResults, pct, teamFlag } from "@/lib/data";
import { MatchupExplorer } from "./MatchupExplorer";

export default async function MatchupPage() {
  const data = await getMatchups();
  const metas = await getTeamMetas();
  const results = await getResults();

  // Build upset list: pairs where Elo gap >= 100 and underdog has highest P(win)
  type Upset = {
    favorite: string;
    underdog: string;
    elo_gap: number;
    p_underdog_wins: number;
    p_draw: number;
    expected_score: string;
    rating_ratio: number;
  };
  const upsets: Upset[] = [];
  const seen = new Set<string>();
  for (const [key, cell] of Object.entries(data.matchups)) {
    const [a, b] = key.split("|");
    const eloA = metas[a]?.elo ?? 1500;
    const eloB = metas[b]?.elo ?? 1500;
    if (eloA === eloB) continue;
    const favorite = eloA > eloB ? a : b;
    const underdog = eloA > eloB ? b : a;
    const pairKey = [favorite, underdog].sort().join("|");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const eloGap = Math.abs(eloA - eloB);
    if (eloGap < 100) continue;
    const pUnderdog = eloA > eloB ? cell.p_b : cell.p_a;
    const pDraw = cell.p_d;
    upsets.push({
      favorite,
      underdog,
      elo_gap: eloGap,
      p_underdog_wins: pUnderdog,
      p_draw: pDraw,
      expected_score: `${cell.ea.toFixed(1)}-${cell.eb.toFixed(1)}`,
      rating_ratio: pUnderdog / Math.max(0.001, eloGap / 200),
    });
  }
  // Most likely upsets: highest P(underdog wins) among large-Elo-gap pairs
  const topUpsets = upsets
    .filter((u) => u.elo_gap >= 150)
    .sort((a, b) => b.p_underdog_wins - a.p_underdog_wins)
    .slice(0, 12);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Matchup predictor</h1>
        <p className="text-muted-foreground">
          Pick any two teams and see win/draw/loss probability, expected score and most-likely
          scoreline, drawn from the Bayesian Dixon Coles posterior at a neutral venue.
        </p>
      </section>

      <MatchupExplorer
        data={data}
        championProbs={results.probabilities.champion}
        finalProbs={results.probabilities.final}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⚡ Most likely upsets
            <Badge variant="outline" className="text-xs">
              Elo gap ≥ 150
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Pairs where the model gives the underdog the highest chance of beating the favorite,
            among matchups with a meaningful Elo gap. Underdog probabilities here marginalize over
            all of the model's posterior uncertainty.
          </p>
          <ul className="space-y-2">
            {topUpsets.map((u, i) => (
              <li
                key={`${u.favorite}-${u.underdog}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-md bg-muted/40 text-sm"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="w-6 text-center text-muted-foreground tabular-nums shrink-0">{i + 1}</span>
                  <Link
                    href={`/teams/${encodeURIComponent(u.underdog)}`}
                    className="flex items-center gap-1.5 font-medium hover:text-emerald-400 min-w-0"
                  >
                    <span className="text-lg shrink-0">{teamFlag(u.underdog)}</span>
                    <span className="truncate">{u.underdog}</span>
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">beats</span>
                  <Link
                    href={`/teams/${encodeURIComponent(u.favorite)}`}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground min-w-0"
                  >
                    <span className="text-lg shrink-0">{teamFlag(u.favorite)}</span>
                    <span className="truncate">{u.favorite}</span>
                  </Link>
                </div>
                <span className="sm:ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums pl-8 sm:pl-0">
                  <span title="Elo gap">Δ{u.elo_gap.toFixed(0)}</span>
                  <span title="Expected score (underdog-favorite)">{u.expected_score}</span>
                  <span className="text-emerald-400 font-semibold">
                    {pct(u.p_underdog_wins)} win · {pct(u.p_draw)} draw
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
