import type { Player } from "@/lib/squads";
import { Badge } from "@/components/ui/badge";

const POSITION_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Goalkeepers", positions: ["GK"] },
  { label: "Defenders", positions: ["CB", "LB", "RB", "LWB", "RWB"] },
  { label: "Midfielders", positions: ["CDM", "CM", "CAM", "LM", "RM"] },
  { label: "Forwards", positions: ["LW", "RW", "ST", "CF"] },
];

function positionColor(pos: string | null): string {
  if (!pos) return "bg-muted text-muted-foreground";
  if (pos === "GK") return "bg-amber-500/15 text-amber-500 ring-amber-500/30";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(pos))
    return "bg-sky-500/15 text-sky-400 ring-sky-500/30";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(pos))
    return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  return "bg-rose-500/15 text-rose-400 ring-rose-500/30";
}

function ratingTone(r: number | null): string {
  if (r == null) return "text-muted-foreground";
  if (r >= 88) return "text-amber-500";
  if (r >= 82) return "text-emerald-500";
  if (r >= 75) return "text-sky-400";
  return "text-muted-foreground";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PlayerCard({ p }: { p: Player }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 ring-1 ring-border/40 hover:bg-muted/50 transition-colors">
      {/* Position chip avatar */}
      <div
        className={`shrink-0 w-11 h-11 rounded-full flex flex-col items-center justify-center ring-1 ${positionColor(
          p.position,
        )}`}
      >
        <span className="text-[10px] font-bold leading-none mb-0.5">
          {p.position ?? "?"}
        </span>
        <span className="text-[10px] font-semibold leading-none opacity-80">
          {initials(p.name)}
        </span>
      </div>
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{p.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {p.club ?? "Unattached"}
          {p.age != null && <span> · {p.age}y</span>}
          {p.foot && <span> · {p.foot[0]}</span>}
        </div>
      </div>
      {/* Overall */}
      <div className="shrink-0 text-right">
        <div className={`text-2xl font-bold tabular-nums leading-none ${ratingTone(p.overall)}`}>
          {p.overall ?? "?"}
        </div>
        {p.potential != null && p.potential !== p.overall && (
          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
            ↑ {p.potential}
          </div>
        )}
      </div>
    </div>
  );
}

export function SquadList({
  players,
  team,
}: {
  players: Player[];
  team: string;
}) {
  if (!players?.length) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No squad data available for {team}.
      </div>
    );
  }

  // Bucket players by position group
  const groups = POSITION_GROUPS.map((g) => ({
    ...g,
    players: players.filter((p) => p.position && g.positions.includes(p.position)),
  })).filter((g) => g.players.length > 0);

  // Catch any with unknown position
  const knownPositions = new Set(POSITION_GROUPS.flatMap((g) => g.positions));
  const other = players.filter((p) => !p.position || !knownPositions.has(p.position));
  if (other.length) groups.push({ label: "Other", positions: [], players: other });

  // Stats summary
  const overalls = players.map((p) => p.overall).filter((v): v is number => v != null);
  const meanRating = overalls.reduce((a, b) => a + b, 0) / Math.max(1, overalls.length);
  const top11 = [...overalls].sort((a, b) => b - a).slice(0, 11);
  const top11Mean = top11.reduce((a, b) => a + b, 0) / Math.max(1, top11.length);

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Top {players.length} players from EA FC 25
        </span>
        <Badge variant="outline" className="text-[10px]">
          Mean rating <span className="font-mono ml-1">{meanRating.toFixed(1)}</span>
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          Top 11 <span className="font-mono ml-1">{top11Mean.toFixed(1)}</span>
        </Badge>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </h3>
            <span className="text-[10px] text-muted-foreground">{g.players.length}</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.players.map((p, i) => (
              <PlayerCard key={`${p.name}-${i}`} p={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
