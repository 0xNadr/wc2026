"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
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

type StageBadge = { label: string; tone: string };

function stageBadge(stage: string, group: string | null): StageBadge {
  if (group)
    return {
      label: `Group ${group}`,
      tone: "bg-muted text-muted-foreground border-border",
    };
  if (stage === "Round of 32")
    return { label: "R32", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30" };
  if (stage === "Round of 16")
    return { label: "R16", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" };
  if (stage === "Quarter-final")
    return { label: "QF", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" };
  if (stage === "Semi-final")
    return { label: "SF", tone: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30" };
  if (stage === "Third place")
    return { label: "3rd", tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30" };
  if (stage === "Final")
    return { label: "FINAL", tone: "bg-live/15 text-live border-live/30" };
  return { label: stage, tone: "bg-muted text-muted-foreground border-border" };
}

function isPlaceholder(team: string): boolean {
  return /^(Winner|Runner-up|Loser|3rd)\b/i.test(team);
}

function TeamLabel({ name, align }: { name: string; align: "left" | "right" }) {
  const placeholder = isPlaceholder(name);
  const flag = (
    <span className="text-base shrink-0 leading-none">
      {placeholder ? "·" : teamFlag(name)}
    </span>
  );
  const label = (
    <span
      className={`truncate ${
        placeholder ? "text-muted-foreground italic" : "font-medium"
      }`}
    >
      {name}
    </span>
  );
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

  // First match in the filtered set whose kickoff is in the future — gets the live dot.
  const nextMatchId = useMemo(() => {
    if (!mounted) return null;
    const now = Date.now();
    const next = filtered.find((m) => new Date(m.kickoffUtc).getTime() >= now);
    return next?.match ?? null;
  }, [filtered, mounted]);

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
    <div className="space-y-4">
      {/* Controls strip */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 bg-card border border-border rounded-sm p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Globe className="w-3.5 h-3.5" /> Timezone
          </span>
          <select
            value={tzKnown ? tz : BROWSER_TZ_VALUE}
            onChange={(e) => changeTz(e.target.value)}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm min-w-[14rem]"
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
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm"
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All matches" : s}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-muted-foreground sm:ml-auto">
          {filtered.length} match{filtered.length === 1 ? "" : "es"} · times in{" "}
          <span className="font-mono text-foreground/80">{tz}</span>
        </div>
      </div>

      {/* Day-by-day list — Flashscore-style: tight rows, hairlines, day headers */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        {grouped.map(({ dateKey, heading, matches }, gi) => (
          <section key={dateKey}>
            <h2
              className={`bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-baseline justify-between border-y border-border ${
                gi === 0 ? "border-t-0" : ""
              }`}
            >
              <span>{heading}</span>
              <span className="tabular-nums normal-case font-normal">
                {matches.length} match{matches.length === 1 ? "" : "es"}
              </span>
            </h2>
            <ul className="divide-y divide-border">
              {matches.map((m) => {
                const { time } = inZone(m.kickoffUtc, tz);
                const tzAbbr = tzAbbrev(m.kickoffUtc, tz);
                const sb = stageBadge(m.stage, m.group);
                const isNext = m.match === nextMatchId;
                return (
                  <li
                    key={m.match}
                    className={`relative grid grid-cols-[3.25rem_3.5rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 sm:gap-x-3 px-3 py-2 text-sm hover:bg-muted/40 transition-colors ${
                      isNext
                        ? "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-live"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="font-mono tabular-nums font-semibold text-foreground">
                        {time}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {tzAbbr}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide border rounded-sm tabular-nums ${sb.tone}`}
                    >
                      {sb.label}
                    </span>
                    <div className="min-w-0 text-right">
                      <TeamLabel name={m.home} align="right" />
                    </div>
                    <span className="text-muted-foreground/60 text-xs text-center">–</span>
                    <div className="min-w-0">
                      <TeamLabel name={m.away} align="left" />
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0 pl-2">
                      {isNext && <span className="live-dot" aria-label="Next match" />}
                      <span
                        className="text-xs text-muted-foreground truncate max-w-[10rem]"
                        title={m.venue}
                      >
                        {m.city}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
