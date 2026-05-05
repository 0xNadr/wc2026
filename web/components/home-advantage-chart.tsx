import { promises as fs } from "fs";
import path from "path";

type Bucket = {
  n_teams: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  top_5: { team: string; gamma: number }[];
};

type HomeAdvantageData = {
  per_confederation: Record<string, Bucket>;
  all_teams: { team: string; gamma: number; confederation: string }[];
};

const CONF_COLOR: Record<string, string> = {
  CONMEBOL: "bg-emerald-500",
  UEFA: "bg-sky-500",
  CAF: "bg-amber-500",
  AFC: "bg-rose-500",
  CONCACAF: "bg-violet-500",
  OFC: "bg-cyan-500",
  OTHER: "bg-zinc-500",
};

const CONF_TEXT: Record<string, string> = {
  CONMEBOL: "text-emerald-600 dark:text-emerald-300",
  UEFA: "text-sky-600 dark:text-sky-300",
  CAF: "text-amber-600 dark:text-amber-300",
  AFC: "text-rose-600 dark:text-rose-300",
  CONCACAF: "text-violet-600 dark:text-violet-300",
  OFC: "text-cyan-600 dark:text-cyan-300",
  OTHER: "text-zinc-600 dark:text-zinc-300",
};

const CONF_ORDER = ["CONMEBOL", "AFC", "OFC", "CAF", "UEFA", "CONCACAF", "OTHER"];

async function loadData(): Promise<HomeAdvantageData> {
  const file = path.join(process.cwd(), "public", "home_advantage.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as HomeAdvantageData;
}

export async function HomeAdvantageChart() {
  const data = await loadData();
  const confs = Object.entries(data.per_confederation)
    .filter(([, v]) => v.n_teams > 0)
    .sort(([a], [b]) => CONF_ORDER.indexOf(a) - CONF_ORDER.indexOf(b));

  // Compute bar scaling using min/max across confederation means so the visual
  // spread is honest (it's small — that's the finding).
  const means = confs.map(([, v]) => v.mean);
  const minMean = Math.min(...means);
  const maxMean = Math.max(...means);
  const range = Math.max(maxMean - minMean, 0.001);

  const top10 = data.all_teams.slice(0, 10);
  const minGamma = data.all_teams[data.all_teams.length - 1].gamma;
  const maxGamma = data.all_teams[0].gamma;
  const teamRange = Math.max(maxGamma - minGamma, 0.001);

  return (
    <div className="space-y-5">
      {/* Confederation summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Mean γ by confederation
        </h4>
        <ul className="space-y-1.5">
          {confs.map(([conf, v]) => {
            const fill = ((v.mean - minMean) / range) * 100;
            return (
              <li key={conf} className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-2 text-sm">
                <span className={`font-semibold ${CONF_TEXT[conf] ?? "text-foreground"}`}>
                  {conf}
                </span>
                <span className="relative h-4 bg-muted rounded-sm overflow-hidden">
                  <span
                    className={`absolute left-0 top-0 bottom-0 ${CONF_COLOR[conf] ?? "bg-zinc-500"} opacity-80`}
                    style={{ width: `${Math.max(fill, 2)}%` }}
                  />
                  <span className="relative z-10 px-1.5 text-[11px] font-mono tabular-nums leading-4 text-foreground/80">
                    n={v.n_teams}
                  </span>
                </span>
                <span className="text-right font-mono tabular-nums text-sm">
                  {v.mean.toFixed(3)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          Bars scaled to the (small) spread between confederations. CONMEBOL trends highest, in
          line with the altitude/away-fan effects in the Latin American football literature.
        </p>
      </div>

      {/* Top-10 individual teams */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top 10 teams by posterior γ
        </h4>
        <ul className="space-y-1">
          {top10.map((t, i) => {
            const fill = ((t.gamma - minGamma) / teamRange) * 100;
            return (
              <li
                key={t.team}
                className="grid grid-cols-[1.25rem_minmax(8rem,1fr)_minmax(0,1.5fr)_3.5rem] items-center gap-2 text-sm"
              >
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground text-right">
                  {i + 1}
                </span>
                <span className="font-medium truncate">{t.team}</span>
                <span className="relative h-3 bg-muted rounded-sm overflow-hidden">
                  <span
                    className={`absolute left-0 top-0 bottom-0 ${CONF_COLOR[t.confederation] ?? "bg-zinc-500"} opacity-80`}
                    style={{ width: `${Math.max(fill, 2)}%` }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums text-xs">
                  {t.gamma.toFixed(3)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Interpretation */}
      <div className="text-xs text-muted-foreground space-y-2 border-t border-border pt-3">
        <p>
          <span className="text-foreground font-medium">What this shows.</span> Per-team home
          advantage γᵢ is hierarchical (Normal around a global mean of{" "}
          <span className="font-mono">≈0.274</span> log-goals, posterior σ ≈ 0.025). The data
          doesn&rsquo;t pull individual teams far from the global mean — but it is enough to
          surface the right tier. Bolivia (La Paz, 3,640 m) and Chile lead, Ecuador and Peru sit
          above average, and CONMEBOL as a whole has the highest confederation-mean γ.
        </p>
        <p>
          <span className="text-foreground font-medium">Why so flat?</span> National teams play
          relatively few home matches (5-15 a year), and many qualifiers are at neutral or
          quasi-neutral venues. The hierarchical shrinkage prior pulls thin-data teams toward the
          global mean. The directional signal is correct; the magnitudes are honest about how
          much the data supports.
        </p>
      </div>
    </div>
  );
}
