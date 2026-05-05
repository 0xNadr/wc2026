"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Trophy, X } from "lucide-react";
import { teamFlag } from "@/lib/format";
import { CONFEDERATION_NAMES, type TeamMetas } from "@/lib/teams-meta";
import { trackEvent } from "@/lib/analytics";

type Row = {
  team: string;
  meta: TeamMetas[string];
  champion: number;
  advance: number;
};

const CONF_ORDER = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"] as const;

function pct(v: number, d = 1) {
  return `${(v * 100).toFixed(d)}%`;
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function TeamGrid({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = normalize(query.trim());
    return rows.filter((r) => normalize(r.team).includes(q));
  }, [query, rows]);

  const byConf = useMemo(() => {
    const acc: Record<string, Row[]> = {};
    for (const r of filtered) {
      (acc[r.meta.confederation] ??= []).push(r);
    }
    for (const c of Object.keys(acc)) {
      acc[c].sort((a, b) => (b.meta.elo ?? 0) - (a.meta.elo ?? 0));
    }
    return acc;
  }, [filtered]);

  const totalShown = filtered.length;
  const totalAll = rows.length;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams (e.g. Argentina, Bos, Saudi…)"
          className="w-full bg-card border border-border rounded-md pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {query && (
        <div className="text-xs text-muted-foreground">
          {totalShown === 0
            ? `No teams match "${query}"`
            : `Showing ${totalShown} of ${totalAll} teams`}
        </div>
      )}

      {/* Confederation groupings */}
      {CONF_ORDER.map((conf) => {
        const list = byConf[conf];
        if (!list?.length) return null;
        return (
          <Card key={conf}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{CONFEDERATION_NAMES[conf]}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {list.length} {list.length === 1 ? "team" : "teams"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {list.map(({ team, meta, champion, advance }) => (
                  <li key={team}>
                    <Link
                      href={`/teams/${encodeURIComponent(team)}`}
                      onClick={() => trackEvent(`team-click-${team}`)}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-md bg-muted/40 hover:bg-muted transition-colors"
                    >
                      <span className="text-xl sm:text-2xl shrink-0">{teamFlag(team)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{team}</span>
                          {meta.host && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Host
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] sm:text-xs text-muted-foreground font-mono tabular-nums truncate flex items-center gap-1">
                          <span>Elo {meta.elo?.toFixed(0)} · group {meta.group} ·</span>
                          <Trophy className="w-3 h-3 text-amber-500 inline shrink-0" />
                          <span>{pct(champion)}</span>
                        </div>
                      </div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground tabular-nums shrink-0">
                        R32 {pct(advance, 0)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
