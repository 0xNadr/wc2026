"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamFlag } from "@/lib/format";
import type { ScheduleMatch } from "@/lib/schedule";

const STORAGE_KEY = "wc2026.schedule.tz";
const DEFAULT_TZ = "Europe/Berlin";

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function isPlaceholder(team: string): boolean {
  return /^(Winner|Runner-up|Loser|3rd)\b/i.test(team);
}

function TeamRow({ name }: { name: string }) {
  const placeholder = isPlaceholder(name);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-base shrink-0">{placeholder ? "·" : teamFlag(name)}</span>
      <span
        className={`truncate text-sm ${placeholder ? "text-muted-foreground italic" : "font-medium"}`}
      >
        {name}
      </span>
    </div>
  );
}

export function UpcomingMatches({
  matches,
  count = 6,
}: {
  matches: ScheduleMatch[];
  count?: number;
}) {
  const [tz, setTz] = useState<string>(DEFAULT_TZ);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setTz(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const future = matches.filter((m) => new Date(m.kickoffUtc).getTime() >= now);
    const pool = future.length > 0 ? future : matches;
    return pool.slice(0, count);
  }, [matches, count]);

  const stageLabel = (m: ScheduleMatch) =>
    m.group ? `Group ${m.group}` : m.stage;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span>Upcoming matches</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            · {tz}
          </span>
        </CardTitle>
        <Link
          href="/schedule"
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          View all
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 divide-y sm:divide-y-0">
          {upcoming.map((m) => (
            <li
              key={m.match}
              className="py-3 sm:py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/40 last:border-0 sm:[&:nth-last-child(-n+2)]:border-0"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {stageLabel(m)}
                </div>
                <TeamRow name={m.home} />
                <TeamRow name={m.away} />
              </div>
              <div className="flex flex-col items-end shrink-0 text-right">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDate(m.kickoffUtc, tz)}
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  {fmtTime(m.kickoffUtc, tz)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-3 border-t flex justify-end">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-foreground/80"
          >
            Full match schedule
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
