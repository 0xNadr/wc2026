import { ChevronDown, Info, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getResults, pct, teamFlag, topN } from "@/lib/data";
import { getTeamMetas } from "@/lib/teams";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import { ChampionSunburst } from "@/components/sunburst";
import { UpcomingMatches } from "@/components/upcoming-matches";
import { getSchedule } from "@/lib/schedule-data";

export default async function HomePage() {
  const r = await getResults();
  const metas = await getTeamMetas();
  const schedule = await getSchedule();
  const topChampions = topN(r.probabilities.champion, 12, (v) => v);
  const podium = topChampions.slice(0, 3);
  const totalCovered = topChampions.reduce((acc, [, p]) => acc + p, 0);

  // Data-driven copy for the explainer panel — keeps in sync with the model.
  const [leader, leaderP] = podium[0];
  const [second] = podium[1];
  const [third] = podium[2];
  const [fourth] = topChampions[3];
  const [fifth] = topChampions[4];
  const winsOut = Math.round(leaderP * r.n_simulations);
  const lossesOut = r.n_simulations - winsOut;
  const lossMultiplier = ((1 - leaderP) / leaderP).toFixed(1);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="space-y-3">
        <Badge variant="outline" className="text-xs">
          🇺🇸 🇨🇦 🇲🇽 · 11 Jun to 19 Jul 2026 · 48 teams · 12 groups
        </Badge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          Who lifts the trophy in 2026?
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base sm:text-lg">
          Bayesian Monte Carlo simulator running{" "}
          <span className="font-mono font-semibold text-foreground">
            {r.n_simulations.toLocaleString()}
          </span>{" "}
          tournament rollouts on a Dixon-Coles model fitted to a century of international results
          plus EA FC 25 squad strength.
        </p>
      </section>

      {/* Explainer — collapsed by default; tap to learn how to read the numbers */}
      <details className="group bg-card border border-border rounded-sm overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer list-none hover:bg-muted/40 transition-colors">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4 text-muted-foreground shrink-0" />
            What does &ldquo;{leader} {pct(leaderP, 1)}&rdquo; actually mean?
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0" />
        </summary>
        <div className="px-4 py-4 text-sm leading-relaxed border-t border-border space-y-3 text-muted-foreground">
          <p>
            The numbers below are{" "}
            <span className="text-foreground font-medium">chances, not predictions</span>. The model
            plays the World Cup{" "}
            <span className="font-mono text-foreground">
              {r.n_simulations.toLocaleString()}
            </span>{" "}
            times. <span className="text-foreground font-medium">{leader}</span> wins about{" "}
            <span className="font-mono text-foreground">{winsOut.toLocaleString()}</span> of those —
            that&rsquo;s where {pct(leaderP, 1)} comes from. The other{" "}
            <span className="font-mono text-foreground">~{lossesOut.toLocaleString()}</span> times,
            somebody else lifts the trophy.
          </p>
          <p>
            <span className="text-foreground font-medium">Why no team is above ~16%.</span>{" "}
            Winning the World Cup means winning seven matches in a row. Even the best team
            doesn&rsquo;t pull that off most of the time. A 48-team tournament is wide open by
            design — in every modern World Cup the favorite has sat between 15% and 25%.
          </p>
          <p>
            <span className="text-foreground font-medium">How to read it.</span>{" "}
            {leader} at {pct(leaderP, 1)} is the model&rsquo;s top pick — but it&rsquo;s also
            saying it&rsquo;s about{" "}
            <span className="font-mono text-foreground">{lossMultiplier}×</span> more likely that
            someone else wins. The interesting part is the order and the gaps: {leader} ≈ {second}{" "}
            ≈ {third} are basically tied at the top, then a step down to {fourth} and {fifth}.
          </p>
          <p>
            <span className="text-foreground font-medium">What&rsquo;s not in the model.</span>{" "}
            It doesn&rsquo;t know about injuries, suspensions, or the final squads (those land in
            late May). It uses a century of match results, current Elo ratings, and player ratings
            from EA FC 25.
          </p>
        </div>
      </details>

      {/* Podium — trophy plinth: 2nd left, 1st center elevated, 3rd right */}
      {(() => {
        const order = [
          { idx: 1, place: 2 }, // silver, left
          { idx: 0, place: 1 }, // gold, center
          { idx: 2, place: 3 }, // bronze, right
        ];
        const medalColor = [
          "text-amber-400",
          "text-slate-300",
          "text-orange-400",
        ];
        const tones = [
          "from-amber-400/25 via-amber-500/10 to-transparent ring-amber-500/40",
          "from-slate-300/25 via-slate-400/10 to-transparent ring-slate-400/40",
          "from-orange-400/25 via-orange-500/10 to-transparent ring-orange-500/40",
        ];
        const stepHeights = ["h-32", "h-44", "h-24"]; // 2nd, 1st, 3rd
        const flagSizes = ["text-5xl", "text-6xl sm:text-7xl", "text-4xl"];
        return (
          <section className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
            {order.map(({ idx, place }, slot) => {
              const [team, p] = podium[idx];
              return (
                <div key={team} className="flex flex-col items-center gap-2">
                  <div className="text-center min-w-0 w-full">
                    <div className={flagSizes[slot]}>{teamFlag(team)}</div>
                    <div className="font-bold text-sm sm:text-base truncate mt-1">{team}</div>
                    <div className="text-xl sm:text-2xl font-bold tabular-nums leading-tight">
                      {pct(p, 1)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                      F {pct(r.probabilities.final[team] ?? 0, 0)} · SF{" "}
                      {pct(r.probabilities.semifinal[team] ?? 0, 0)}
                    </div>
                  </div>
                  <div
                    className={`${stepHeights[slot]} w-full rounded-t-lg bg-gradient-to-b ${tones[idx]} ring-1 flex items-start justify-center pt-2`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <Medal className={`w-6 h-6 sm:w-7 sm:h-7 ${medalColor[idx]}`} />
                      <div className="text-[10px] sm:text-xs font-bold text-muted-foreground tabular-nums">
                        #{place}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })()}

      {/* Top 12 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Top 12 favorites</span>
            <span className="text-xs font-normal text-muted-foreground">
              cover {pct(totalCovered)} of all simulated outcomes
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {topChampions.map(([team, p], i) => {
              const isTop3 = i < 3;
              return (
                <li key={team} className="flex items-center gap-2 sm:gap-4">
                  <div className="w-5 sm:w-6 text-center text-xs sm:text-sm tabular-nums text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="text-xl sm:text-2xl">{teamFlag(team)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">{team}</span>
                      <span
                        className={`font-mono tabular-nums text-sm ${
                          isTop3 ? "font-bold" : ""
                        }`}
                      >
                        {pct(p, 2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${
                          isTop3 ? "bg-emerald-500" : "bg-emerald-500/60"
                        }`}
                        style={{ width: `${Math.min(100, p * 100 * 4)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Upcoming matches preview — tap to see full schedule */}
      <UpcomingMatches matches={schedule.matches} />

      {/* Sunburst: where champion probability lives by confederation */}
      <Card>
        <CardHeader>
          <CardTitle>Champion probability by confederation</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampionSunburst
            championProbs={r.probabilities.champion}
            metas={metas}
          />
        </CardContent>
      </Card>

      {/* Stage advance grid */}
      <Card>
        <CardHeader>
          <CardTitle>Stage advance probabilities (top 8 favorites)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2 font-medium">Team</th>
                {STAGES.map((s) => (
                  <th key={s} className="text-right p-2 font-medium tabular-nums">
                    {STAGE_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topChampions.slice(0, 8).map(([team]) => (
                <tr key={team} className="border-b last:border-0">
                  <td className="p-2 font-medium flex items-center gap-2">
                    <span className="text-lg">{teamFlag(team)}</span>
                    {team}
                  </td>
                  {STAGES.map((s) => {
                    const v = r.probabilities[s][team] ?? 0;
                    const intensity = Math.min(1, v * 1.5);
                    return (
                      <td
                        key={s}
                        className="text-right p-2 font-mono tabular-nums"
                        style={{
                          backgroundColor: `rgba(16, 185, 129, ${intensity * 0.15})`,
                        }}
                      >
                        {pct(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
        <Badge variant="outline">Calibration</Badge>
        <p>
          Back-tested against 2018 + 2022 World Cups: Brier{" "}
          <span className="font-mono font-medium">0.58</span>, accuracy{" "}
          <span className="font-mono font-medium">55 to 58%</span>, in line with FiveThirtyEight SPI
          and bookmaker-grade systems. Fitted on ~31k international matches since 1990 with
          time-decay (4-yr half-life, cross-validated) and tournament-importance weighting.
          Squad-strength prior validated against weekly-refreshed Transfermarkt market values
          (Spearman 0.96, max champion-% shift 0.65pp).
        </p>
      </section>
    </div>
  );
}
