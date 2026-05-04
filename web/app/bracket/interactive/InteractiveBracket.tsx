"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { teamFlag } from "@/lib/format";
import type { MatchupCell } from "@/lib/matchups";

type R32Init = {
  a: string;
  b: string;
  probA: number;
  probB: number;
  defaultPick: "a" | "b";
};
type Pick = "a" | "b";
type Picks = Record<string, Pick>; // key = `${stage}-${idx}`


const STAGES = ["R32", "R16", "QF", "SF", "Final"] as const;
const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-Finals",
  SF: "Semi-Finals",
  Final: "Final",
};

function lookupCell(
  matchups: Record<string, MatchupCell>,
  a: string,
  b: string,
): { probA: number; probB: number } {
  const ab = matchups[`${a}|${b}`];
  if (ab) return { probA: ab.p_a + ab.p_d / 2, probB: ab.p_b + ab.p_d / 2 };
  const ba = matchups[`${b}|${a}`];
  if (ba) return { probA: ba.p_b + ba.p_d / 2, probB: ba.p_a + ba.p_d / 2 };
  return { probA: 0.5, probB: 0.5 };
}

export function InteractiveBracket({
  initialR32,
  matchupsData,
}: {
  initialR32: R32Init[];
  matchupsData: Record<string, MatchupCell>;
}) {
  const [picks, setPicks] = useState<Picks>(() => {
    // Pre-fill R32 with the server-computed default (pairwise favorite).
    const p: Picks = {};
    for (let i = 0; i < initialR32.length; i++) {
      p[`R32-${i}`] = initialR32[i].defaultPick;
    }
    return p;
  });

  // Compute matches per stage with cascading teams
  const stages = useMemo(() => {
    const result: Record<string, Array<{ a: string; b: string; probA: number; probB: number; pick: Pick }>> = {};
    // R32
    result.R32 = initialR32.map((m, i) => ({
      ...m,
      pick: picks[`R32-${i}`] ?? m.defaultPick,
    }));

    // Subsequent rounds: pair up winners. Default pick is the model's pairwise
    // favorite, matching what the user sees in the percentages.
    for (let s = 1; s < STAGES.length; s++) {
      const prev = STAGES[s - 1];
      const cur = STAGES[s];
      const prevMatches = result[prev];
      const matches: Array<{ a: string; b: string; probA: number; probB: number; pick: Pick }> = [];
      for (let i = 0; i < prevMatches.length; i += 2) {
        const ma = prevMatches[i];
        const mb = prevMatches[i + 1];
        const winnerA = ma.pick === "a" ? ma.a : ma.b;
        const winnerB = mb.pick === "a" ? mb.a : mb.b;
        const { probA, probB } = lookupCell(matchupsData, winnerA, winnerB);
        const idx = i / 2;
        const p = picks[`${cur}-${idx}`] ?? (probA >= probB ? "a" : "b");
        matches.push({ a: winnerA, b: winnerB, probA, probB, pick: p });
      }
      result[cur] = matches;
    }
    return result;
  }, [picks, initialR32, matchupsData]);

  function setPick(stage: string, idx: number, p: Pick) {
    const key = `${stage}-${idx}`;
    setPicks((prev) => {
      // Override this stage; downstream picks become stale and re-derive automatically
      // because our useMemo defaults to higher-prob on missing keys.
      const next = { ...prev, [key]: p };
      // Wipe downstream user-overrides for cleanliness — when the team changes,
      // the user's picks downstream may no longer be valid.
      const stageIdx = STAGES.indexOf(stage as any);
      for (let s = stageIdx + 1; s < STAGES.length; s++) {
        const stg = STAGES[s];
        Object.keys(next).forEach((k) => {
          if (k.startsWith(`${stg}-`)) delete next[k];
        });
      }
      return next;
    });
  }

  function reset() {
    setPicks({});
  }

  const final = stages.Final?.[0];
  const champion = final ? (final.pick === "a" ? final.a : final.b) : null;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">🏆 Your champion:</span>
              {champion ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{teamFlag(champion)}</span>
                  <span className="font-bold truncate">{champion}</span>
                </span>
              ) : (
                "TBD"
              )}
            </span>
            <Button variant="outline" size="sm" onClick={reset} className="self-start sm:self-auto">
              Reset to model picks
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {STAGES.map((stage) => (
        <Card key={stage}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{STAGE_LABEL[stage]}</span>
              <Badge variant="outline" className="text-xs">
                {stages[stage].length} {stages[stage].length === 1 ? "match" : "matches"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stages[stage].map((m, i) => (
                <li key={i} className="flex items-stretch border border-border rounded-md overflow-hidden">
                  <button
                    onClick={() => setPick(stage, i, "a")}
                    className={`flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors ${
                      m.pick === "a"
                        ? "bg-emerald-600/30 font-semibold"
                        : "bg-card hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <span className="text-base sm:text-lg shrink-0">{teamFlag(m.a)}</span>
                    <span className="flex-1 text-left truncate min-w-0">{m.a}</span>
                    <span className="text-[10px] font-mono opacity-70 shrink-0">
                      {(m.probA * 100).toFixed(0)}%
                    </span>
                  </button>
                  <div className="flex items-center px-1.5 sm:px-2 text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                    vs
                  </div>
                  <button
                    onClick={() => setPick(stage, i, "b")}
                    className={`flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors ${
                      m.pick === "b"
                        ? "bg-emerald-600/30 font-semibold"
                        : "bg-card hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-mono opacity-70 shrink-0">
                      {(m.probB * 100).toFixed(0)}%
                    </span>
                    <span className="flex-1 text-right truncate min-w-0">{m.b}</span>
                    <span className="text-base sm:text-lg shrink-0">{teamFlag(m.b)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
