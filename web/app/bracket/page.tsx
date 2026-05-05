import { Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResults, pct, teamFlag } from "@/lib/data";
import { getMatchups } from "@/lib/matchups";
import { getTeamMetas } from "@/lib/teams";
import { buildModalBracket, type BracketMatch } from "@/lib/bracket";
import { BracketDiagram } from "@/components/bracket-diagram";

const STAGES = [
  { key: "round_of_32", label: "Round of 32", n: 32 },
  { key: "round_of_16", label: "Round of 16", n: 16 },
  { key: "quarterfinal", label: "Quarter-Finals", n: 8 },
  { key: "semifinal", label: "Semi-Finals", n: 4 },
  { key: "final", label: "Final", n: 2 },
  { key: "champion", label: "Champion", n: 1 },
] as const;

export default async function BracketPage() {
  const r = await getResults();
  const mu = await getMatchups();
  const metas = await getTeamMetas();
  const matches = buildModalBracket(r, mu);

  // Group matches by stage for display
  const byStage: Record<string, BracketMatch[]> = {};
  for (const m of matches) (byStage[m.stage] ??= []).push(m);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Knockout bracket</h1>
        <p className="text-muted-foreground">
          Probability each team reaches each knockout stage, derived from{" "}
          {r.n_simulations.toLocaleString()} simulated tournaments. The modal path below picks the
          most likely team in each starting slot and walks the bracket using pairwise win
          probabilities. One of many possible timelines.
        </p>
      </section>

      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] to-transparent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-500" />
            Most-likely bracket path
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BracketDiagram
            byStage={byStage}
            ctx={{
              metas,
              championProbs: r.probabilities.champion,
              advanceProbs: r.probabilities.round_of_32,
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STAGES.map((s) => {
          const probs = r.probabilities[s.key];
          const ranked = Object.entries(probs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, s.n)
            .filter(([, p]) => p > 0.001);
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{s.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">top {ranked.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {ranked.map(([team, p]) => (
                    <li key={team} className="flex items-center gap-2">
                      <span className="text-base shrink-0">{teamFlag(team)}</span>
                      <span className="flex-1 truncate font-medium min-w-0">{team}</span>
                      <span className="font-mono tabular-nums text-muted-foreground shrink-0 text-xs sm:text-sm">{pct(p)}</span>
                      <div
                        className="h-1.5 rounded-full bg-emerald-500/80 shrink-0 hidden sm:block"
                        style={{ width: `${Math.max(2, Math.min(80, p * 90))}px` }}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
