"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamFlag } from "@/lib/format";
import { TIMEZONE_OPTIONS, type ScheduleMatch } from "@/lib/schedule";

const DEFAULT_TZ = "Europe/Berlin";
const STORAGE_KEY = "wc2026.schedule.tz";
const BROWSER_TZ_VALUE = "__browser__";

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function inZone(iso: string, tz: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = get("hour") === "24" ? "00" : get("hour");
  const time = `${hour}:${get("minute")}`;
  return { dateKey, weekday: get("weekday"), time };
}

function formatHeading(dateKey: string, tz: string): string {
  const [y, m, dd] = dateKey.split("-").map(Number);
  // Build a UTC noon Date for that calendar day so weekday/format is stable
  const d = new Date(Date.UTC(y, m - 1, dd, 12));
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function tzAbbrev(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date(iso));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function stageBadge(stage: string, group: string | null) {
  if (group) return { label: `Group ${group}`, tone: "bg-muted text-foreground/80" };
  if (stage === "Round of 32")
    return { label: "R32", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
  if (stage === "Round of 16")
    return { label: "R16", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (stage === "Quarter-final")
    return { label: "QF", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  if (stage === "Semi-final")
    return { label: "SF", tone: "bg-orange-500/15 text-orange-300 border-orange-500/30" };
  if (stage === "Third place")
    return { label: "3rd", tone: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" };
  if (stage === "Final")
    return { label: "FINAL", tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  return { label: stage, tone: "bg-muted text-foreground/80" };
}

function isPlaceholder(team: string): boolean {
  return /^(Winner|Runner-up|Loser|3rd)\b/i.test(team);
}

function TeamCell({ name, group }: { name: string; group: string | null }) {
  const placeholder = isPlaceholder(name);
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {!placeholder && <span className="text-base shrink-0">{teamFlag(name)}</span>}
      <span className={`truncate ${placeholder ? "text-muted-foreground italic" : "font-medium"}`}>
        {name}
      </span>
      {group && !placeholder && (
        <span className="text-[10px] text-muted-foreground tabular-nums">({group})</span>
      )}
    </span>
  );
}

export function ScheduleView({ matches }: { matches: ScheduleMatch[] }) {
  const [tz, setTz] = useState<string>(DEFAULT_TZ);
  const [stage, setStage] = useState<string>("all");
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

  function changeTz(value: string) {
    const resolved = value === BROWSER_TZ_VALUE ? browserTz() : value;
    setTz(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      /* ignore */
    }
  }

  const stages = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      set.add(m.group ? "Groups" : m.stage);
    }
    return ["all", ...Array.from(set)];
  }, [matches]);

  const filtered = useMemo(() => {
    if (stage === "all") return matches;
    if (stage === "Groups") return matches.filter((m) => m.group);
    return matches.filter((m) => m.stage === stage);
  }, [matches, stage]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, ScheduleMatch[]>();
    for (const m of filtered) {
      const { dateKey } = inZone(m.kickoffUtc, tz);
      const arr = buckets.get(dateKey) ?? [];
      arr.push(m);
      buckets.set(dateKey, arr);
    }
    const sortedKeys = Array.from(buckets.keys()).sort();
    return sortedKeys.map((k) => ({
      dateKey: k,
      heading: formatHeading(k, tz),
      matches: buckets.get(k)!.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)),
    }));
  }, [filtered, tz]);

  const tzKnown = TIMEZONE_OPTIONS.some((o) => o.value === tz);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Globe className="w-3.5 h-3.5" /> Timezone
          </span>
          <select
            value={tzKnown ? tz : BROWSER_TZ_VALUE}
            onChange={(e) => changeTz(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm min-w-[14rem]"
          >
            <option value={BROWSER_TZ_VALUE}>
              Auto-detect{mounted && !tzKnown ? ` (${tz})` : ""}
            </option>
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm"
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All matches" : s}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-muted-foreground sm:ml-auto">
          {filtered.length} match{filtered.length === 1 ? "" : "es"} · times shown in{" "}
          <span className="font-mono text-foreground/80">{tz}</span>
        </div>
      </div>

      {/* Day-by-day list */}
      <div className="space-y-4">
        {grouped.map(({ dateKey, heading, matches }) => (
          <Card key={dateKey}>
            <CardContent className="p-0">
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-baseline justify-between">
                <h2 className="font-semibold tracking-tight">{heading}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {matches.length} match{matches.length === 1 ? "" : "es"}
                </span>
              </div>
              <ul className="divide-y grid grid-cols-[auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                {matches.map((m) => {
                  const { time } = inZone(m.kickoffUtc, tz);
                  const tzAbbr = tzAbbrev(m.kickoffUtc, tz);
                  const sb = stageBadge(m.stage, m.group);
                  return (
                    <li
                      key={m.match}
                      className="col-span-full grid grid-cols-subgrid items-center gap-x-3 sm:gap-x-4 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-col items-start sm:items-center sm:flex-row sm:gap-2">
                        <span className="font-mono tabular-nums font-semibold">{time}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {tzAbbr}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] tabular-nums ${sb.tone}`}
                      >
                        {sb.label}
                      </Badge>
                      <div className="flex justify-end min-w-0">
                        <TeamCell name={m.home} group={m.homeGroup} />
                      </div>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <div className="min-w-0">
                        <TeamCell name={m.away} group={m.awayGroup} />
                      </div>
                      <div className="hidden sm:flex flex-col items-end text-right min-w-0">
                        <span className="text-xs text-muted-foreground truncate max-w-[14rem]">
                          {m.city}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                          M{m.match}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
