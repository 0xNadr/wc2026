import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getResults, teamFlag } from "@/lib/data";
import { getTeamMetas } from "@/lib/teams";
import { ScenarioExplorer } from "./ScenarioExplorer";

export default async function AlternatePage() {
  const r = await getResults();
  const metas = await getTeamMetas();
  const realities = r.alternate_realities;

  const championCounts = realities.reduce<Record<string, number>>((acc, t) => {
    acc[t.champion] = (acc[t.champion] ?? 0) + 1;
    return acc;
  }, {});
  const championRanking = Object.entries(championCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Alternate realities</h1>
        <p className="text-muted-foreground">
          Explore how the tournament shifts under different assumptions, then browse{" "}
          {realities.length} sampled tournament rollouts from the model's actual posterior.
        </p>
      </section>

      <ScenarioExplorer baseChampion={r.probabilities.champion} metas={metas} />

      <Card>
        <CardHeader>
          <CardTitle>Champions across {realities.length} sampled timelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {championRanking.map(([team, count]) => (
              <Badge key={team} variant="secondary" className="text-sm">
                <span className="mr-1">{teamFlag(team)}</span>
                {team} <span className="ml-2 font-mono text-muted-foreground">×{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {realities.map((t, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>Timeline #{i + 1}</span>
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{teamFlag(t.champion)}</span>
                <div>
                  <div className="font-semibold">{t.champion}</div>
                  <div className="text-xs text-muted-foreground">
                    beat {teamFlag(t.runner_up)} {t.runner_up}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                <span className="font-medium">SF:</span>{" "}
                {t.semifinalists.map((x) => `${teamFlag(x)} ${x}`).join(", ")}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
