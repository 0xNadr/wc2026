import { promises as fs } from "fs";
import path from "path";

type Row = {
  team: string;
  ea_z: number | null;
  tm_z: number | null;
  delta_z: number | null;
};

type Data = {
  spearman: number;
  ea_top_12: string[];
  tm_top_12: string[];
  all_teams: Row[];
};

type ResultsRow = {
  team: string;
  ea_pct: number;
  tm_pct: number;
  delta_pct: number;
};

type ResultsData = {
  n_simulations: number;
  teams: ResultsRow[];
};

async function load(): Promise<Data> {
  const file = path.join(process.cwd(), "public", "squad_source_comparison.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as Data;
}

async function loadResults(): Promise<ResultsData> {
  const file = path.join(process.cwd(), "public", "squad_source_results.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as ResultsData;
}

export async function SquadSourceComparison() {
  const d = await load();
  const results = await loadResults();
  const withDelta = d.all_teams.filter((r) => r.delta_z !== null) as (Row & {
    delta_z: number;
  })[];
  const upMovers = withDelta.slice().sort((a, b) => b.delta_z - a.delta_z).slice(0, 6);
  const downMovers = withDelta.slice().sort((a, b) => a.delta_z - b.delta_z).slice(0, 6);
  const maxAbs = Math.max(...withDelta.map((r) => Math.abs(r.delta_z)));

  const Mover = ({ r, sign }: { r: Row & { delta_z: number }; sign: "up" | "down" }) => {
    const widthPct = (Math.abs(r.delta_z) / maxAbs) * 100;
    const isUp = sign === "up";
    return (
      <li className="grid grid-cols-[minmax(7rem,1fr)_minmax(0,1.5fr)_3rem] items-center gap-2 text-sm">
        <span className="font-medium truncate">{r.team}</span>
        <span className="relative h-3 bg-muted rounded-sm overflow-hidden">
          <span
            className={`absolute top-0 bottom-0 ${
              isUp ? "left-0 bg-emerald-500/70" : "right-0 bg-rose-500/70"
            }`}
            style={{ width: `${Math.max(widthPct, 2)}%` }}
          />
        </span>
        <span
          className={`text-right font-mono tabular-nums text-xs ${
            isUp
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-rose-600 dark:text-rose-300"
          }`}
        >
          {r.delta_z >= 0 ? "+" : ""}
          {r.delta_z.toFixed(2)}σ
        </span>
      </li>
    );
  };

  // Top-12 reshuffle (rank, EA name, TM name)
  const reshuffleRows = Array.from({ length: 12 }, (_, i) => ({
    rank: i + 1,
    ea: d.ea_top_12[i],
    tm: d.tm_top_12[i],
    same: d.ea_top_12[i] === d.tm_top_12[i],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 text-sm">
        <span className="text-muted-foreground">Spearman rank correlation</span>
        <span className="font-mono tabular-nums text-2xl font-bold text-foreground">
          {d.spearman.toFixed(3)}
        </span>
        <span className="text-xs text-muted-foreground">
          (1.0 = identical ranks, 0.0 = unrelated)
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        EA FC 25 ratings (annual scout panel + performance data) vs. Transfermarkt market values
        (weekly-refreshed crowd-sourced valuations). Across all 48 qualified teams the two priors
        agree strongly on rank order — most meaningful disagreements concern teams whose Elo and
        on-paper depth diverge.
      </p>

      {/* Up movers */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Biggest UP movers — TM ranks higher than EA FC
        </h4>
        <ul className="space-y-1">
          {upMovers.map((r) => (
            <Mover key={r.team} r={r} sign="up" />
          ))}
        </ul>
      </div>

      {/* Down movers */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Biggest DOWN movers — TM ranks lower than EA FC
        </h4>
        <ul className="space-y-1">
          {downMovers.map((r) => (
            <Mover key={r.team} r={r} sign="down" />
          ))}
        </ul>
      </div>

      {/* Top-12 reshuffle */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top 12 — by each prior
        </h4>
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">#</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            EA FC 25
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Transfermarkt
          </span>
          {reshuffleRows.map((r) => (
            <div key={r.rank} className="contents">
              <span className="font-mono tabular-nums text-muted-foreground text-xs">
                {r.rank}
              </span>
              <span className={`truncate ${r.same ? "" : "text-muted-foreground"}`}>{r.ea}</span>
              <span
                className={`truncate ${
                  r.same ? "" : "text-emerald-600 dark:text-emerald-300 font-medium"
                }`}
              >
                {r.tm}
                {!r.same && <span className="ml-1 text-[10px]">↔</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        <span className="text-foreground font-medium">Interpretation.</span> Most movement is
        directionally consistent with current bookmaker consensus and recent form: England up
        (deep Premier League pool), Saudi Arabia/Iran/Korea down (TM more sceptical of underrated
        domestic leagues), Norway / Ivory Coast / Morocco up (Haaland, Diaby, Hakimi command real
        market value). Where the two disagree most is on age-curve teams: TM rewards young
        valuations (Yamal, Bellingham, Mbappé) while EA FC rates current ability irrespective of
        contract value.
      </p>

      {/* Champion-% deltas after a full retrain on the TM prior */}
      <div className="border-t border-border pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Champion probability — full retrain on each prior
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Both priors were used to fit the full Bayesian model and run{" "}
          {results.n_simulations.toLocaleString()} tournament simulations. Top-12 numbers from
          each:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[10px] uppercase tracking-wide">
                <th className="text-left py-1.5 pr-3 font-medium">Team</th>
                <th className="text-right py-1.5 px-2 font-medium">EA FC (prod)</th>
                <th className="text-right py-1.5 px-2 font-medium">Transfermarkt</th>
                <th className="text-right py-1.5 pl-2 font-medium">Δ pp</th>
              </tr>
            </thead>
            <tbody>
              {results.teams.slice(0, 12).map((r) => (
                <tr key={r.team} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{r.team}</td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {(r.ea_pct * 100).toFixed(2)}%
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted-foreground">
                    {(r.tm_pct * 100).toFixed(2)}%
                  </td>
                  <td
                    className={`py-1.5 pl-2 text-right font-mono tabular-nums ${
                      r.delta_pct >= 0
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-rose-600 dark:text-rose-300"
                    }`}
                  >
                    {r.delta_pct >= 0 ? "+" : ""}
                    {(r.delta_pct * 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Maximum shift on any team:{" "}
          <span className="font-mono text-foreground">
            {(
              Math.max(...results.teams.map((r) => Math.abs(r.delta_pct))) * 100
            ).toFixed(2)}
            pp
          </span>
          . The top-12 rank order is preserved entirely. Spain still leads, Brazil and Argentina
          stay 2&ndash;3, England and France stay 4&ndash;5. The forecast is robust to the
          choice of squad-strength source.
        </p>
      </div>

      {/* Decision rationale */}
      <div className="border-t border-border pt-4 bg-muted/30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 rounded-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
          Why EA FC stays as production
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
          <li>
            <span className="text-foreground font-medium">Ability-focused.</span> EA FC scout
            ratings target current on-pitch ability. TM market values bake in age, contract
            length, league inflation, and hype — a 17yo with potential can outvalue a 32yo who
            is the actual starter.
          </li>
          <li>
            <span className="text-foreground font-medium">Forecast is robust.</span> Spearman
            0.961 and a max 0.65pp champion-% shift mean the choice is methodologically minor.
            Either prior produces essentially the same numbers.
          </li>
          <li>
            <span className="text-foreground font-medium">TM is wired and available.</span> The
            pipeline supports{" "}
            <code className="text-[11px]">--squad-source tm</code>; users who prefer the
            market-value framing can reproduce the TM run from the same code.
          </li>
        </ul>
      </div>
    </div>
  );
}
