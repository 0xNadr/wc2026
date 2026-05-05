"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import type { TeamMetas } from "@/lib/teams";
import { teamFlag } from "@/lib/format";

type Slice = {
  team: string;
  p: number;
  confederation: string;
};

type Hover =
  | { kind: "conf"; conf: string; total: number }
  | { kind: "team"; conf: string; team: string; p: number }
  | null;

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
  const [hover, setHover] = useState<Hover>(null);

  const ranked: Slice[] = Object.entries(championProbs)
    .map(([team, p]) => ({ team, p, confederation: metas[team]?.confederation ?? "OTHER" }))
    .sort((a, b) => b.p - a.p);

  const top = ranked.slice(0, topN);
  const groupedRest = ranked.slice(topN).reduce<Record<string, number>>((acc, s) => {
    acc[s.confederation] = (acc[s.confederation] ?? 0) + s.p;
    return acc;
  }, {});

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

  let cur = -Math.PI / 2;
  const arcs: React.ReactElement[] = [];
  const POP = size * 0.022;

  const hoveredConf = hover?.conf ?? null;

  confSorted.forEach(([conf, info], ci) => {
    const angle = (info.total / grandTotal) * Math.PI * 2;
    const start = cur;
    const end = cur + angle;
    const color = CONFEDERATION_COLOR[conf] ?? "#888";
    const dimmed = hoveredConf !== null && hoveredConf !== conf;

    const cMid = (start + end) / 2;
    arcs.push(
      <path
        key={`c-${ci}`}
        className="sb-slice"
        d={arcPath(cx, cy, rInner, rMid, start, end)}
        fill={color}
        opacity={dimmed ? 0.25 : 0.85}
        stroke="hsl(0 0% 12%)"
        strokeWidth={1}
        style={{
          ["--tx" as string]: `${Math.cos(cMid) * POP}px`,
          ["--ty" as string]: `${Math.sin(cMid) * POP}px`,
        }}
        onMouseEnter={() => setHover({ kind: "conf", conf, total: info.total })}
        onMouseLeave={() => setHover(null)}
      />,
    );

    let teamCur = start;
    info.teams.forEach((t, ti) => {
      const tAngle = (t.p / info.total) * angle;
      const tMid = teamCur + tAngle / 2;
      const isHoveredTeam =
        hover?.kind === "team" && hover.conf === conf && hover.team === t.team;
      const teamDimmed =
        hover?.kind === "team"
          ? !isHoveredTeam
          : dimmed;
      arcs.push(
        <path
          key={`t-${ci}-${ti}`}
          className="sb-slice"
          d={arcPath(cx, cy, rMid, rOuter, teamCur, teamCur + tAngle)}
          fill={color}
          opacity={
            teamDimmed
              ? 0.2
              : 0.45 + 0.4 * (1 - ti / Math.max(1, info.teams.length))
          }
          stroke="hsl(0 0% 12%)"
          strokeWidth={0.5}
          style={{
            ["--tx" as string]: `${Math.cos(tMid) * POP}px`,
            ["--ty" as string]: `${Math.sin(tMid) * POP}px`,
          }}
          onMouseEnter={() => setHover({ kind: "team", conf, team: t.team, p: t.p })}
          onMouseLeave={() => setHover(null)}
        />,
      );
      teamCur += tAngle;
    });

    cur = end;
  });

  const centerLine1 =
    hover?.kind === "team"
      ? `${teamFlag(hover.team)} ${hover.team}`.trim()
      : hover?.kind === "conf"
        ? hover.conf
        : null;
  const centerLine2 =
    hover?.kind === "team"
      ? `${(hover.p * 100).toFixed(2)}% · ${hover.conf}`
      : hover?.kind === "conf"
        ? `${(hover.total * 100).toFixed(2)}%`
        : null;

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[280px] sm:max-w-[360px] h-auto md:shrink-0"
        preserveAspectRatio="xMidYMid meet"
      >
        <style>{`
          .sb-arcs .sb-slice {
            transition: transform 180ms ease-out, opacity 180ms ease-out, filter 180ms ease-out;
            transform-box: fill-box;
            transform-origin: center;
            cursor: pointer;
          }
          .sb-arcs .sb-slice:hover {
            transform: translate(var(--tx), var(--ty));
            filter: brightness(1.08) drop-shadow(0 2px 4px rgba(0,0,0,0.25));
          }
          .sb-center text { transition: opacity 150ms ease-out; }
        `}</style>
        <g className="sb-arcs">{arcs}</g>
        <g className="sb-center pointer-events-none">
          {centerLine1 ? (
            <>
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: rInner * 0.32, fontWeight: 600 }}
              >
                {centerLine1}
              </text>
              <text
                x={cx}
                y={cy + rInner * 0.38}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: rInner * 0.26 }}
              >
                {centerLine2}
              </text>
            </>
          ) : (
            <Trophy
              x={cx - rInner * 0.6}
              y={cy - rInner * 0.6}
              width={rInner * 1.2}
              height={rInner * 1.2}
              className="text-amber-500"
            />
          )}
        </g>
      </svg>
      <ul className="space-y-1 text-sm w-full md:w-auto">
        {confSorted.map(([conf, info]) => {
          const active = hoveredConf === conf;
          const dim = hoveredConf !== null && !active;
          return (
            <li
              key={conf}
              className="flex items-center gap-2 rounded px-1 -mx-1 transition-colors"
              style={{
                backgroundColor: active ? "hsl(0 0% 100% / 0.06)" : "transparent",
                opacity: dim ? 0.4 : 1,
              }}
              onMouseEnter={() => setHover({ kind: "conf", conf, total: info.total })}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ background: CONFEDERATION_COLOR[conf] ?? "#888" }}
              />
              <span className="font-medium w-20">{conf}</span>
              <span className="text-muted-foreground font-mono tabular-nums">
                {(info.total * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
        <li className="text-xs text-muted-foreground pt-1 mt-1 border-t border-border">
          Outer ring = per-team probability
        </li>
      </ul>
    </div>
  );
}
