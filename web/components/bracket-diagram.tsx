import { teamFlag, pct } from "@/lib/format";
import type { BracketMatch } from "@/lib/bracket";
import type { TeamMetas } from "@/lib/teams-meta";
import { TeamHover } from "@/components/team-hover";

type Stage = "R32" | "R16" | "QF" | "SF" | "Final";

type TeamCtx = {
  metas?: TeamMetas;
  championProbs?: Record<string, number>;
  advanceProbs?: Record<string, number>;
};

const STAGE_LABEL: Record<Stage, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-Finals",
  SF: "Semi-Finals",
  Final: "Final",
};

function MatchCard({
  match,
  highlightChampion,
  ctx,
}: {
  match: BracketMatch;
  highlightChampion?: boolean;
  ctx?: TeamCtx;
}) {
  const aWin = match.winner === match.team_a;
  // Use the actual pairwise win probability for the winner, not 1 - p_a (which
  // would lump in the draw probability and overstate the favorite).
  const probWinner = match.prob_winner;
  const isFinal = match.stage === "Final";

  return (
    <div
      className={`rounded-md overflow-hidden text-[11px] leading-tight ring-1 w-full ${
        isFinal && highlightChampion
          ? "ring-amber-500/60 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
          : "ring-border/60"
      } bg-card`}
    >
      <Row team={match.team_a} winner={aWin} prob={aWin ? probWinner : null} ctx={ctx} />
      <div className="border-t border-border/40" />
      <Row team={match.team_b} winner={!aWin} prob={!aWin ? probWinner : null} ctx={ctx} />
    </div>
  );
}

function Row({
  team,
  winner,
  prob,
  ctx,
}: {
  team: string;
  winner: boolean;
  prob: number | null;
  ctx?: TeamCtx;
}) {
  const inner = (
    <div
      className={`flex items-center gap-1 px-1.5 py-1 cursor-pointer ${
        winner
          ? "bg-emerald-500/10 text-foreground font-medium"
          : "text-muted-foreground"
      } hover:bg-muted/50 transition-colors`}
    >
      <span className="text-xs shrink-0">{teamFlag(team)}</span>
      <span className="flex-1 truncate min-w-0">{team}</span>
      {prob !== null && (
        <span
          className={`font-mono tabular-nums shrink-0 text-[10px] ${
            winner ? "text-emerald-500" : ""
          }`}
        >
          {pct(prob, 0)}
        </span>
      )}
    </div>
  );

  if (!ctx?.metas) return inner;

  return (
    <TeamHover
      team={team}
      meta={ctx.metas[team]}
      championProb={ctx.championProbs?.[team]}
      advanceProb={ctx.advanceProbs?.[team]}
    >
      {inner}
    </TeamHover>
  );
}

function placedMatches(
  matches: BracketMatch[],
  col: number,
  startRow: number,
  rowSpan: number,
  rowGap: number,
  side: "left" | "right",
  ctx?: TeamCtx,
) {
  return matches.map((m, i) => (
    <div
      key={`${m.stage}-${side}-${i}`}
      className="flex items-center"
      style={{
        gridColumnStart: col,
        gridRowStart: startRow + i * rowGap + 2, // +2: row 1 is the header
        gridRowEnd: `span ${rowSpan}`,
      }}
    >
      <MatchCard match={m} ctx={ctx} />
    </div>
  ));
}

export function BracketDiagram({
  byStage,
  ctx,
}: {
  byStage: Record<string, BracketMatch[]>;
  ctx?: TeamCtx;
}) {
  const r32L = (byStage.R32 ?? []).slice(0, 8);
  const r32R = (byStage.R32 ?? []).slice(8, 16);
  const r16L = (byStage.R16 ?? []).slice(0, 4);
  const r16R = (byStage.R16 ?? []).slice(4, 8);
  const qfL = (byStage.QF ?? []).slice(0, 2);
  const qfR = (byStage.QF ?? []).slice(2, 4);
  const sfL = (byStage.SF ?? []).slice(0, 1);
  const sfR = (byStage.SF ?? []).slice(1, 2);
  const final = byStage.Final?.[0];

  return (
    <div className="space-y-6">
      {/* Desktop: full bracket — fits in container, no horizontal scroll */}
      <div className="hidden lg:block">
        <div
          className="grid gap-x-1.5 gap-y-1 w-full"
          style={{
            gridTemplateColumns:
              "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",
            gridTemplateRows: "auto repeat(16, minmax(42px, auto))",
          }}
        >
          {/* Header row */}
          {(["R32", "R16", "QF", "SF", "Final", "SF", "QF", "R16", "R32"] as const).map(
            (label, i) => (
              <div
                key={i}
                className={`text-[10px] uppercase tracking-wider font-semibold text-center pb-2 ${
                  i === 4 ? "text-amber-500/90" : "text-muted-foreground"
                }`}
                style={{ gridColumn: i + 1, gridRow: 1 }}
              >
                {label}
              </div>
            ),
          )}

          {placedMatches(r32L, 1, 0, 2, 2, "left", ctx)}
          {placedMatches(r16L, 2, 0, 4, 4, "left", ctx)}
          {placedMatches(qfL, 3, 0, 8, 8, "left", ctx)}
          {placedMatches(sfL, 4, 0, 16, 16, "left", ctx)}

          {/* Center column: Champion + Final card */}
          {final && (
            <div
              className="flex flex-col items-stretch justify-center gap-2 px-0.5 min-w-0"
              style={{ gridColumn: 5, gridRow: "2 / span 16" }}
            >
              <div className="rounded-lg bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent ring-2 ring-amber-500/40 p-2 text-center min-w-0">
                <div className="text-[9px] uppercase tracking-widest text-amber-500/90 font-semibold mb-1">
                  🏆 Champion
                </div>
                <div className="text-3xl mb-1">{teamFlag(final.winner)}</div>
                <div className="font-bold text-sm truncate">{final.winner}</div>
                {ctx?.championProbs?.[final.winner] != null && (
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono tabular-nums">
                    wins it all {pct(ctx.championProbs[final.winner], 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-center text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                  Final
                </div>
                <MatchCard match={final} highlightChampion ctx={ctx} />
              </div>
            </div>
          )}

          {placedMatches(sfR, 6, 0, 16, 16, "right", ctx)}
          {placedMatches(qfR, 7, 0, 8, 8, "right", ctx)}
          {placedMatches(r16R, 8, 0, 4, 4, "right", ctx)}
          {placedMatches(r32R, 9, 0, 2, 2, "right", ctx)}
        </div>
      </div>

      {/* Mobile/tablet: stacked by stage with champion banner */}
      <div className="lg:hidden space-y-5">
        {final && (
          <div className="rounded-lg bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent ring-2 ring-amber-500/40 p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-amber-500/90 font-semibold mb-1">
              🏆 Modal Champion
            </div>
            <div className="text-5xl mb-1">{teamFlag(final.winner)}</div>
            <div className="font-bold text-lg">{final.winner}</div>
            {ctx?.championProbs?.[final.winner] != null && (
              <div className="text-xs text-muted-foreground mt-1 font-mono tabular-nums">
                wins it all {pct(ctx.championProbs[final.winner], 1)}
              </div>
            )}
          </div>
        )}
        {(["R32", "R16", "QF", "SF", "Final"] as const).map((stage) => (
          <div key={stage}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              {STAGE_LABEL[stage]}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(byStage[stage] ?? []).map((m, i) => (
                <MatchCard key={i} match={m} highlightChampion={stage === "Final"} ctx={ctx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
