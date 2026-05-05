import Link from "next/link";
import { Goal, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamFlag } from "@/lib/data";
import { getGoldenBoot } from "@/lib/goldenBoot";

export default async function GoldenBootPage() {
  const entries = await getGoldenBoot();
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const medalColor = ["text-amber-400", "text-slate-300", "text-orange-400"];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Goal className="w-7 h-7 text-amber-500" />
          Golden Boot: top scorer prediction
        </h1>
        <p className="text-muted-foreground">
          Per-player expected tournament goals, computed as{" "}
          <span className="font-mono text-xs">
            E[goals] = share × E[team goals/match] × E[games played]
          </span>
          . Share is the player's exponentially time-decayed slice of their nation's international
          goals since 2022; team goals/match uses the posterior mean λ; games played uses the
          knockout stage probabilities from the simulation.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {podium.map((p, i) => (
          <Card
            key={p.scorer}
            className={`bg-gradient-to-br ${[
              "from-amber-400/20 to-amber-500/5 border-amber-500/40",
              "from-slate-300/20 to-slate-400/5 border-slate-400/40",
              "from-orange-400/20 to-orange-500/5 border-orange-500/40",
            ][i]} border-2`}
          >
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <Medal className={`w-7 h-7 ${medalColor[i]}`} />
                <Link
                  href={`/teams/${encodeURIComponent(p.team)}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {teamFlag(p.team)} {p.team}
                </Link>
              </div>
              <div>
                <div className="text-xl font-bold">{p.scorer}</div>
                <div className="text-3xl font-bold tabular-nums">
                  {p.expected_player_goals.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">expected tournament goals</div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                <span>{(p.blended_share * 100).toFixed(0)}% national-team share</span>
                <span>{p.n_recent_goals} recent goals</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 30 expected scorers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-1.5 sm:p-2 font-medium w-6 sm:w-8">#</th>
                <th className="text-left p-1.5 sm:p-2 font-medium">Player</th>
                <th className="text-left p-1.5 sm:p-2 font-medium">Team</th>
                <th className="text-right p-1.5 sm:p-2 font-medium tabular-nums hidden sm:table-cell">Goal share</th>
                <th className="text-right p-1.5 sm:p-2 font-medium tabular-nums hidden md:table-cell">Team xG</th>
                <th className="text-right p-1.5 sm:p-2 font-medium tabular-nums">xGoals</th>
                <th className="text-right p-1.5 sm:p-2 font-medium tabular-nums hidden md:table-cell">Recent</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((p) => {
                const intensity = Math.min(1, p.expected_player_goals / 2);
                return (
                  <tr key={p.scorer} className="border-b last:border-0">
                    <td className="p-1.5 sm:p-2 font-mono tabular-nums text-muted-foreground">
                      {p.rank}
                    </td>
                    <td className="p-1.5 sm:p-2 font-medium">{p.scorer}</td>
                    <td className="p-1.5 sm:p-2">
                      <Link
                        href={`/teams/${encodeURIComponent(p.team)}`}
                        className="inline-flex items-center gap-1 sm:gap-1.5 hover:text-foreground"
                      >
                        <span>{teamFlag(p.team)}</span>
                        <span className="text-muted-foreground hidden sm:inline">{p.team}</span>
                      </Link>
                    </td>
                    <td className="p-1.5 sm:p-2 text-right font-mono tabular-nums hidden sm:table-cell">
                      {(p.blended_share * 100).toFixed(1)}%
                    </td>
                    <td className="p-1.5 sm:p-2 text-right font-mono tabular-nums hidden md:table-cell">
                      {p.expected_team_goals.toFixed(1)}
                    </td>
                    <td
                      className="p-1.5 sm:p-2 text-right font-mono tabular-nums font-semibold"
                      style={{
                        backgroundColor: `rgba(245, 158, 11, ${intensity * 0.2})`,
                      }}
                    >
                      {p.expected_player_goals.toFixed(2)}
                    </td>
                    <td className="p-1.5 sm:p-2 text-right font-mono tabular-nums text-muted-foreground hidden md:table-cell">
                      {p.n_recent_goals}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
          <Badge variant="outline" className="text-[10px]">Caveats</Badge>
          <p>
            Baseline estimator only. Point estimates, no per tournament Monte Carlo. Players who
            retire between their last goal and the WC may still appear; emerging stars (Yamal,
            Wirtz) are under-weighted because their international scoring history is short. Squad
            filter and minutes/role adjustment will land once the official 26-man rosters are
            released (~2026-06-01).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
