"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { teamFlag } from "@/lib/format";
import type { ScheduleMatch } from "@/lib/schedule";

const STORAGE_KEY = "wc2026.schedule.tz";
const DEFAULT_TZ = "Europe/Berlin";

function inZone(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("day")} ${get("month")}`,
    time: `${hour}:${get("minute")}`,
  };
}

function isPlaceholder(team: string): boolean {
  return /^(Winner|Runner-up|Loser|3rd)\b/i.test(team);
}

type TeamAlign = "left" | "right" | "left-mobile-right-desktop";

function TeamLabel({ name, align }: { name: string; align: TeamAlign }) {
  const placeholder = isPlaceholder(name);
  const flag = (
    <span className="text-base shrink-0 leading-none">
      {placeholder ? "·" : teamFlag(name)}
    </span>
  );
  const label = (
    <span
      className={`truncate text-sm ${
        placeholder ? "text-muted-foreground italic" : "font-medium"
      }`}
    >
      {name}
    </span>
  );
  if (align === "left-mobile-right-desktop") {
    return (
      <span className="flex items-center gap-1.5 min-w-0 justify-start sm:justify-end">
        <span className="contents sm:hidden">
          {flag}
          {label}
        </span>
        <span className="hidden sm:contents">
          {label}
          {flag}
        </span>
      </span>
    );
  }
  return (
    <span
      className={`flex items-center gap-1.5 min-w-0 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {align === "right" ? (
        <>
          {label}
          {flag}
        </>
      ) : (
        <>
          {flag}
          {label}
        </>
      )}
    </span>
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const stageLabel = (m: ScheduleMatch) => (m.group ? `Group ${m.group}` : m.stage);

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between bg-muted px-3 py-1.5 border-b border-border">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="live-dot" aria-hidden />
          Upcoming matches
        </h2>
        <Link
          href="/schedule"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          View all
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-border">
        {upcoming.map((m, i) => {
          const { date, time } = mounted
            ? inZone(m.kickoffUtc, tz)
            : { date: "", time: "" };
          const isNext = i === 0;
          return (
            <li
              key={m.match}
              className={`relative flex items-center gap-2 sm:gap-3 px-3 py-2 text-sm hover:bg-muted/40 transition-colors ${
                isNext
                  ? "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-live"
                  : ""
              }`}
            >
              <div className="flex flex-col leading-tight shrink-0 w-14">
                <span className="font-mono tabular-nums font-semibold text-foreground text-xs">
                  {date}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                  {time}
                </span>
              </div>
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 sm:flex-1 sm:text-right">
                  <TeamLabel name={m.home} align="left-mobile-right-desktop" />
                </div>
                <span className="hidden sm:inline text-muted-foreground/60 text-xs">–</span>
                <div className="min-w-0 sm:flex-1">
                  <TeamLabel name={m.away} align="left" />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide tabular-nums shrink-0 whitespace-nowrap">
                {stageLabel(m)}
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        href="/schedule"
        className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border-t border-border bg-muted/40 py-2 transition-colors"
      >
        Full match schedule
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
