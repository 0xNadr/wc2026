"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamFlag } from "@/lib/format";
import type { Matchups } from "@/lib/matchups";
import { trackEvent } from "@/lib/analytics";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function TeamPicker({
  label,
  teams,
  value,
  onChange,
}: {
  label: string;
  teams: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MatchupExplorer({
  data,
  championProbs = {},
  finalProbs = {},
}: {
  data: Matchups;
  championProbs?: Record<string, number>;
  finalProbs?: Record<string, number>;
}) {
  const teams = data.teams;
  const [a, setA] = useState("Argentina");
  const [b, setB] = useState("Brazil");

  useEffect(() => {
    if (a === b) return;
    const pair = [a, b].slice().sort().join("-vs-");
    const t = setTimeout(() => trackEvent(`matchup-${pair}`), 600);
    return () => clearTimeout(t);
  }, [a, b]);

  const cell = data.matchups[`${a}|${b}`];
  if (!cell || a === b) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <TeamPicker label="Team A" teams={teams} value={a} onChange={setA} />
          <TeamPicker label="Team B" teams={teams} value={b} onChange={setB} />
        </div>
        <p className="text-sm text-muted-foreground">Pick two different teams.</p>
      </div>
    );
  }

  const winnerColor = cell.p_a > cell.p_b ? "emerald" : cell.p_b > cell.p_a ? "rose" : "amber";

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-background/90 backdrop-blur border-b border-border/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <TeamPicker label="Team A" teams={teams} value={a} onChange={setA} />
          <TeamPicker label="Team B" teams={teams} value={b} onChange={setB} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-sm sm:text-base">
            <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-xl sm:text-2xl shrink-0">{teamFlag(a)}</span>
              <span className="truncate">{a}</span>
            </span>
            <span className="text-xs text-muted-foreground shrink-0">vs</span>
            <span className="flex items-center gap-1.5 sm:gap-2 min-w-0 justify-end">
              <span className="truncate">{b}</span>
              <span className="text-xl sm:text-2xl shrink-0">{teamFlag(b)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex h-8 rounded-md overflow-hidden text-xs font-mono text-white">
              <div
                className="bg-emerald-600 flex items-center justify-center px-2"
                style={{ width: `${cell.p_a * 100}%` }}
              >
                {pct(cell.p_a)}
              </div>
              <div
                className="bg-amber-500 flex items-center justify-center px-2"
                style={{ width: `${cell.p_d * 100}%` }}
              >
                {pct(cell.p_d)}
              </div>
              <div
                className="bg-rose-600 flex items-center justify-center px-2"
                style={{ width: `${cell.p_b * 100}%` }}
              >
                {pct(cell.p_b)}
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{a} wins</span>
              <span>Draw</span>
              <span>{b} wins</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Expected score</div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums">
                {cell.ea.toFixed(2)} <span className="text-muted-foreground">−</span>{" "}
                {cell.eb.toFixed(2)}
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Most likely scoreline</div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums">{cell.top_score}</div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Favorite</div>
              <div className="text-base sm:text-lg font-bold flex items-center justify-center gap-1">
                {cell.p_a > cell.p_b ? (
                  <>
                    {teamFlag(a)} {a}
                  </>
                ) : cell.p_b > cell.p_a ? (
                  <>
                    {teamFlag(b)} {b}
                  </>
                ) : (
                  "Toss-up"
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            {[a, b].map((t) => (
              <div key={t} className="rounded-md bg-muted/30 p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-base">{teamFlag(t)}</span>
                  <span className="text-xs font-medium">{t} tournament outlook</span>
                </div>
                <div className="flex justify-center gap-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">Champion</div>
                    <div className="font-mono tabular-nums font-semibold">
                      {((championProbs[t] ?? 0) * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reach final</div>
                    <div className="font-mono tabular-nums font-semibold">
                      {((finalProbs[t] ?? 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t flex items-start gap-2">
            <Badge variant="outline" className="text-[10px] shrink-0">
              Neutral venue
            </Badge>
            <span>
              Head-to-head probabilities (top bar) sampled from{" "}
              {data.n_samples.toLocaleString()} posterior draws of the Dixon-Coles model. The
              tournament-outlook numbers are aggregated across the 50,000 simulated tournaments
              and account for each team's bracket path, so they can disagree with the head-to-head
              favorite.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
