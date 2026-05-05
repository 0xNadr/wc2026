import { Trophy } from "lucide-react";
import type { TeamMetas } from "@/lib/teams";

type Slice = {
  team: string;
  p: number;
  confederation: string;
};

const CONFEDERATION_COLOR: Record<string, string> = {
  UEFA: "#3b82f6",
  CONMEBOL: "#10b981",
  CONCACAF: "#f59e0b",
  CAF: "#ef4444",
  AFC: "#8b5cf6",
  OFC: "#ec4899",
};

function arcPath(
  cx: number, cy: number, rIn: number, rOut: number,
  startAngle: number, endAngle: number,
): string {
  const x1 = cx + rOut * Math.cos(startAngle);
  const y1 = cy + rOut * Math.sin(startAngle);
  const x2 = cx + rOut * Math.cos(endAngle);
  const y2 = cy + rOut * Math.sin(endAngle);
  const x3 = cx + rIn * Math.cos(endAngle);
  const y3 = cy + rIn * Math.sin(endAngle);
  const x4 = cx + rIn * Math.cos(startAngle);
  const y4 = cy + rIn * Math.sin(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `
    M ${x1} ${y1}
    A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2}
    L ${x3} ${y3}
    A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4}
    Z
  `;
}

export function ChampionSunburst({
  championProbs,
  metas,
  topN = 16,
  size = 360,
}: {
  championProbs: Record<string, number>;
  metas: TeamMetas;
  topN?: number;
  size?: number;
}) {
  // Aggregate by confederation. Use top-N teams; bundle the rest into "Other".
  const ranked: Slice[] = Object.entries(championProbs)
    .map(([team, p]) => ({ team, p, confederation: metas[team]?.confederation ?? "OTHER" }))
    .sort((a, b) => b.p - a.p);

  const top = ranked.slice(0, topN);
  const restP = ranked.slice(topN).reduce((s, x) => s + x.p, 0);
  const groupedRest = ranked.slice(topN).reduce<Record<string, number>>((acc, s) => {
    acc[s.confederation] = (acc[s.confederation] ?? 0) + s.p;
    return acc;
  }, {});

  // Build confederation totals from full set
  const confederationTotals: Record<string, { total: number; teams: Slice[] }> = {};
  for (const s of top) {
    confederationTotals[s.confederation] ??= { total: 0, teams: [] };
    confederationTotals[s.confederation].total += s.p;
    confederationTotals[s.confederation].teams.push(s);
  }
  for (const [c, p] of Object.entries(groupedRest)) {
    confederationTotals[c] ??= { total: 0, teams: [] };
    confederationTotals[c].total += p;
    confederationTotals[c].teams.push({ team: `Other ${c}`, p, confederation: c });
  }

  const confSorted = Object.entries(confederationTotals).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = confSorted.reduce((s, [, x]) => s + x.total, 0);

  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.18;
  const rMid = size * 0.30;
  const rOuter = size * 0.46;

  let cur = -Math.PI / 2; // start at 12 o'clock
  const arcs: React.ReactElement[] = [];

  confSorted.forEach(([conf, info], ci) => {
    const angle = (info.total / grandTotal) * Math.PI * 2;
    const start = cur;
    const end = cur + angle;
    const color = CONFEDERATION_COLOR[conf] ?? "#888";

    // Inner ring (confederation)
    arcs.push(
      <path
        key={`c-${ci}`}
        d={arcPath(cx, cy, rInner, rMid, start, end)}
        fill={color}
        opacity={0.85}
        stroke="hsl(0 0% 12%)"
        strokeWidth={1}
      />,
    );

    // Outer ring: teams within this confederation
    let teamCur = start;
    info.teams.forEach((t, ti) => {
      const tAngle = (t.p / info.total) * angle;
      arcs.push(
        <path
          key={`t-${ci}-${ti}`}
          d={arcPath(cx, cy, rMid, rOuter, teamCur, teamCur + tAngle)}
          fill={color}
          opacity={0.45 + 0.4 * (1 - ti / Math.max(1, info.teams.length))}
          stroke="hsl(0 0% 12%)"
          strokeWidth={0.5}
        >
          <title>
            {t.team}: {(t.p * 100).toFixed(2)}%
          </title>
        </path>,
      );
      teamCur += tAngle;
    });

    cur = end;
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[280px] sm:max-w-[360px] h-auto md:shrink-0"
        preserveAspectRatio="xMidYMid meet"
      >
        {arcs}
        <Trophy
          x={cx - rInner * 0.6}
          y={cy - rInner * 0.6}
          width={rInner * 1.2}
          height={rInner * 1.2}
          className="text-amber-500"
        />
      </svg>
      <ul className="space-y-1 text-sm w-full md:w-auto">
        {confSorted.map(([conf, info]) => (
          <li key={conf} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ background: CONFEDERATION_COLOR[conf] ?? "#888" }}
            />
            <span className="font-medium w-20">{conf}</span>
            <span className="text-muted-foreground font-mono tabular-nums">
              {(info.total * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
