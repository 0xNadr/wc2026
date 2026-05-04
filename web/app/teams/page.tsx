import { getResults } from "@/lib/data";
import { getTeamMetas } from "@/lib/teams";
import { TeamGrid } from "./TeamGrid";

export default async function TeamsIndex() {
  const r = await getResults();
  const metas = await getTeamMetas();

  const rows = Object.keys(metas).map((team) => ({
    team,
    meta: metas[team],
    champion: r.probabilities.champion[team] ?? 0,
    advance: r.probabilities.round_of_32[team] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <p className="text-muted-foreground">
          All 48 qualified teams grouped by confederation, sorted by current Elo. Click a team to
          see its full forecast: stage survival, group context, toughest matchups.
        </p>
      </section>

      <TeamGrid rows={rows} />
    </div>
  );
}
