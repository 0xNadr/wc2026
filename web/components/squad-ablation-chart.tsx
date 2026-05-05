import { promises as fs } from "fs";
import path from "path";

type Row = {
  team: string;
  production: number;
  pure_elo: number;
  delta: number;
};

type AblationData = {
  production_label: string;
  ablation_label: string;
  teams: Row[];
  n_simulations: number;
};

async function load(): Promise<AblationData> {
  const file = path.join(process.cwd(), "public", "squad_ablation.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as AblationData;
}

function pct(p: number, decimals = 2): string {
  return `${(p * 100).toFixed(decimals)}%`;
}

export async function SquadAblationChart() {
  const d = await load();
  const top12 = d.teams.slice(0, 12);

  // Largest |Δ| across all teams (sets the bar scale)
  const maxAbsDelta = Math.max(...d.teams.map((r) => Math.abs(r.delta)));
  const scale = Math.max(maxAbsDelta, 0.001);

  // Movers (top 8 by |Δ|)
  const movers = d.teams.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        How much does the EA FC squad-strength weight (30% of the prior) actually move the
        forecast? This is the production model vs. a refit with{" "}
        <code className="text-[11px]">squad=None</code> (Elo-only prior). Both at{" "}
        {d.n_simulations.toLocaleString()} simulations.
      </div>

      {/* Top-12 side-by-side */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top 12 — production vs. pure Elo
        </h4>
        <ul className="space-y-1">
          {top12.map((r) => {
            const widthFromCenter = (Math.abs(r.delta) / scale) * 50;
            const isPos = r.delta >= 0;
            return (
              <li
                key={r.team}
                className="grid grid-cols-[minmax(7rem,1fr)_3rem_minmax(0,2fr)_3rem] items-center gap-2 text-sm"
              >
                <span className="font-medium truncate">{r.team}</span>
                <span className="text-right font-mono tabular-nums text-xs">
                  {pct(r.production, 1)}
                </span>
                {/* Centered diverging bar */}
                <span className="relative h-3 bg-muted rounded-sm">
                  <span className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                  <span
                    className={`absolute top-0 bottom-0 ${
                      isPos ? "bg-emerald-500/70 left-1/2" : "bg-rose-500/70 right-1/2"
                    }`}
                    style={{ width: `${Math.max(widthFromCenter, 0.4)}%` }}
                  />
                </span>
                <span
                  className={`text-right font-mono tabular-nums text-xs ${
                    isPos
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-rose-600 dark:text-rose-300"
                  }`}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {(r.delta * 100).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 grid grid-cols-[minmax(7rem,1fr)_3rem_minmax(0,2fr)_3rem] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>team</span>
          <span className="text-right">prod</span>
          <span className="text-center">Δ pure-Elo vs prod (pp)</span>
          <span className="text-right">pp</span>
        </div>
      </div>

      {/* Biggest movers */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Biggest movers (any rank)
        </h4>
        <ul className="space-y-1">
          {movers.map((r) => (
            <li
              key={r.team}
              className="grid grid-cols-[minmax(7rem,1fr)_3.75rem_3.75rem_3rem] items-center gap-2 text-sm"
            >
              <span className="font-medium truncate">{r.team}</span>
              <span className="text-right font-mono tabular-nums text-xs">
                {pct(r.production, 2)}
              </span>
              <span className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                {pct(r.pure_elo, 2)}
              </span>
              <span
                className={`text-right font-mono tabular-nums text-xs ${
                  r.delta >= 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {r.delta >= 0 ? "+" : ""}
                {(r.delta * 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-1 grid grid-cols-[minmax(7rem,1fr)_3.75rem_3.75rem_3rem] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>team</span>
          <span className="text-right">prod</span>
          <span className="text-right">pure-Elo</span>
          <span className="text-right">Δ pp</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        <span className="text-foreground font-medium">Reading.</span> Every team shifts by ≤
        1.2pp. Brazil drops most when squad strength is removed (-1.21pp), Colombia rises most
        (+0.65pp), and the rank order of the top 12 is preserved. The squad-strength signal is
        modest but real — it favours teams with deep, well-rated rosters (Brazil, England, France)
        over teams whose Elo runs ahead of their underlying squad depth (Colombia, Argentina,
        Ecuador).
      </p>
    </div>
  );
}
