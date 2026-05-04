"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import Link from "next/link";
import { teamFlag, pct } from "@/lib/format";
import { CONFEDERATION_NAMES, type TeamMetas } from "@/lib/teams-meta";

export function TeamHover({
  team,
  meta,
  championProb,
  advanceProb,
  children,
}: {
  team: string;
  meta?: TeamMetas[string];
  championProb?: number;
  advanceProb?: number;
  children: React.ReactNode;
}) {
  return (
    <HoverCard.Root openDelay={120} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <Link
          href={`/teams/${encodeURIComponent(team)}`}
          className="contents focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded"
        >
          {children}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={6}
          className="z-50 w-60 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/5 p-3 text-xs animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{teamFlag(team)}</span>
            <div className="min-w-0">
              <div className="font-semibold truncate text-sm">{team}</div>
              {meta && (
                <div className="text-[10px] text-muted-foreground">
                  {CONFEDERATION_NAMES[meta.confederation]}
                  {meta.group ? ` · Group ${meta.group}` : ""}
                  {meta.host ? " · Host" : ""}
                </div>
              )}
            </div>
          </div>
          {meta && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Elo</span>
                <span>{meta.elo?.toFixed(0) ?? "N/A"}</span>
              </div>
              {meta.elo_rank != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rank</span>
                  <span>#{meta.elo_rank}</span>
                </div>
              )}
              {championProb != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">🏆</span>
                  <span>{pct(championProb, championProb < 0.01 ? 2 : 1)}</span>
                </div>
              )}
              {advanceProb != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">R32</span>
                  <span>{pct(advanceProb, 0)}</span>
                </div>
              )}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground text-center">
            Click for full forecast →
          </div>
          <HoverCard.Arrow className="fill-popover" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
