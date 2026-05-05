import { promises as fs } from "fs";
import path from "path";

type SweepResult = {
  half_life_years: number;
  avg_brier: number;
  avg_log_loss: number;
};

type SweepData = { results: SweepResult[] };

async function loadSweep(): Promise<SweepData> {
  const file = path.join(process.cwd(), "public", "halflife_sweep.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as SweepData;
}

export async function HalfLifeChart() {
  const data = await loadSweep();
  const rows = data.results.slice().sort((a, b) => a.half_life_years - b.half_life_years);
  const briers = rows.map((r) => r.avg_brier);
  const minB = Math.min(...briers);
  const maxB = Math.max(...briers);
  const range = Math.max(maxB - minB, 0.001);
  const best = rows.reduce((acc, r) => (r.avg_brier < acc.avg_brier ? r : acc), rows[0]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Avg Brier across the 2018 + 2022 World Cup back-tests at each candidate half-life. Lower
        is better.
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          // Inverted bar — shorter bar = better (lower Brier)
          const fill = ((r.avg_brier - minB) / range) * 100;
          const isBest = r.half_life_years === best.half_life_years;
          const isProduction = r.half_life_years === 4.0;
          return (
            <li
              key={r.half_life_years}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm"
            >
              <span className="font-mono tabular-nums text-muted-foreground">
                {r.half_life_years.toFixed(1)}y
                {isProduction && (
                  <span className="ml-1 text-[9px] uppercase tracking-wide text-brand">
                    prod
                  </span>
                )}
              </span>
              <span className="relative h-4 bg-muted rounded-sm overflow-hidden">
                <span
                  className={`absolute left-0 top-0 bottom-0 ${
                    isBest ? "bg-advance" : "bg-muted-foreground/40"
                  }`}
                  style={{ width: `${Math.max(fill, 2)}%` }}
                />
              </span>
              <span
                className={`text-right font-mono tabular-nums text-sm ${
                  isBest ? "font-bold text-advance" : ""
                }`}
              >
                {r.avg_brier.toFixed(4)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        4.0y wins by a hair (Brier{" "}
        <span className="font-mono">{best.avg_brier.toFixed(4)}</span>), 2.5y is essentially
        tied, and going below 2.0y costs ~0.01-0.02 Brier. Production is set at 4.0y; the model
        is robust in the 2.5-4.0y range.
      </p>
    </div>
  );
}
