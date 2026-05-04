import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getResults, pct, teamFlag } from "@/lib/data";
import { getMatchups } from "@/lib/matchups";
import { getTeamMetas, CONFEDERATION_NAMES } from "@/lib/teams";
import { getSquads } from "@/lib/squads";
import { STAGES, STAGE_LABEL } from "@/lib/types";
import { SurvivalCurve } from "@/components/survival-curve";
import { SquadList } from "@/components/squad-list";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: rawTeam } = await params;
  const team = decodeURIComponent(rawTeam);
  const r = await getResults();
  const metas = await getTeamMetas();
  const mu = await getMatchups();
  const squads = await getSquads();

  const meta = metas[team];
  if (!meta) notFound();
  const squad = squads[team] ?? [];

  // Stage survival probabilities (chart-friendly)
  const survival = STAGES.map((s) => ({
    stage: s,
    label: STAGE_LABEL[s],
    p: r.probabilities[s][team] ?? 0,
  }));

  // Group context: who is in the same group?
  const groupMates = meta.group ? r.groups[meta.group].filter((t) => t !== team) : [];

  // Toughest 5 future opponents from the matchup matrix (lowest p_a for this team)
  const head2head = Object.keys(metas)
    .filter((t) => t !== team)
    .map((opp) => {
      const cell = mu.matchups[`${team}|${opp}`];
      return cell ? { opp, p_win: cell.p_a, p_draw: cell.p_d, p_lose: cell.p_b, ea: cell.ea, eb: cell.eb } : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => a!.p_win - b!.p_win);
  const toughest = head2head.slice(0, 8);
  const easiest = head2head.slice(-5).reverse();

  // Group standing probabilities
  const standings = ["group_winner", "group_runner_up", "group_third_advancing", "group_eliminated"] as const;
  const standingLabels = { group_winner: "1st", group_runner_up: "2nd", group_third_advancing: "3rd → R32", group_eliminated: "Eliminated" };

  return (
    <div className="space-y-6">
      <Link href="/teams" className="text-xs text-muted-foreground hover:text-foreground">
        ← All teams
      </Link>

      <section className="flex items-center gap-3 sm:gap-4">
        <span className="text-5xl sm:text-6xl shrink-0">{teamFlag(team)}</span>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{team}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {CONFEDERATION_NAMES[meta.confederation]} · Group{" "}
            <span className="font-semibold text-foreground">{meta.group}</span>
            {meta.host && <span className="ml-2"><Badge variant="outline" className="text-[10px]">Host</Badge></span>}
          </p>
        </div>
      </section>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Elo rating</div>
            <div className="text-2xl font-bold tabular-nums">{meta.elo?.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">rank #{meta.elo_rank} of 48</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Squad strength</div>
            <div className="text-2xl font-bold tabular-nums">
              {meta.squad_strength?.toFixed(1) ?? "N/A"}
            </div>
            <div className="text-xs text-muted-foreground">top-23 EA FC 25 mean</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Champion %</div>
            <div className="text-2xl font-bold tabular-nums">
              {pct(r.probabilities.champion[team] ?? 0, 2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Reaches R32</div>
            <div className="text-2xl font-bold tabular-nums">
              {pct(r.probabilities.round_of_32[team] ?? 0, 1)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage survival decay curve */}
      <Card>
        <CardHeader>
          <CardTitle>Stage survival</CardTitle>
        </CardHeader>
        <CardContent>
          <SurvivalCurve survival={survival} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Group standing */}
        <Card>
          <CardHeader>
            <CardTitle>Group {meta.group} standing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {standings.map((s) => {
              const p = r.probabilities[s][team] ?? 0;
              return (
                <div key={s} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{standingLabels[s]}</span>
                    <span className="font-mono tabular-nums">{pct(p)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${
                        s === "group_winner" ? "bg-emerald-500" :
                        s === "group_runner_up" ? "bg-emerald-400" :
                        s === "group_third_advancing" ? "bg-amber-400" :
                        "bg-rose-500/60"
                      }`}
                      style={{ width: `${p * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t">
              <div className="text-xs text-muted-foreground mb-2">Group opponents</div>
              <div className="flex flex-wrap gap-1.5">
                {groupMates.map((m) => (
                  <Link
                    key={m}
                    href={`/teams/${encodeURIComponent(m)}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-xs"
                  >
                    <span>{teamFlag(m)}</span>
                    {m}
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Head-to-head insights */}
        <Card>
          <CardHeader>
            <CardTitle>Head-to-head</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1">
                Toughest 8 opponents (P({team} wins))
              </div>
              <ul className="space-y-1">
                {toughest.map((h) => (
                  <li key={h!.opp} className="flex items-center justify-between">
                    <Link
                      href={`/teams/${encodeURIComponent(h!.opp)}`}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <span>{teamFlag(h!.opp)}</span>
                      {h!.opp}
                    </Link>
                    <span className="font-mono text-xs tabular-nums">{pct(h!.p_win, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1">
                Easiest 5 (vs lowest-rated opponents)
              </div>
              <ul className="space-y-1">
                {easiest.map((h) => (
                  <li key={h!.opp} className="flex items-center justify-between">
                    <Link
                      href={`/teams/${encodeURIComponent(h!.opp)}`}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <span>{teamFlag(h!.opp)}</span>
                      {h!.opp}
                    </Link>
                    <span className="font-mono text-xs tabular-nums">{pct(h!.p_win, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Squad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Squad</span>
            <span className="text-xs font-normal text-muted-foreground">
              EA FC 25 ratings
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SquadList players={squad} team={team} />
        </CardContent>
      </Card>
    </div>
  );
}
