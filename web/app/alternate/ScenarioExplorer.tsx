"use client";

import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { ChartBar, Dices, Earth, Globe, Landmark, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { teamFlag } from "@/lib/format";
import type { TeamMetas } from "@/lib/teams";

type ChampionMap = Record<string, number>;
type Scenario = {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  description: string;
  factor: (team: string, meta: TeamMetas[string]) => number;
};

function teamFactor_underdog(elo: number | null): number {
  // Boost low-Elo teams. Average Elo around 1750; tail at ~1500-2150.
  const e = elo ?? 1500;
  return Math.exp(-(e - 1750) / 200); // lower Elo → higher factor
}

const SCENARIOS: Scenario[] = [
  {
    key: "model",
    label: "Form carries through",
    Icon: ChartBar,
    description: "The model's baseline forecast. Current Elo plus squad strength dominate.",
    factor: () => 1,
  },
  {
    key: "underdog",
    label: "Heavy underdogs",
    Icon: Zap,
    description: "What if low-Elo teams keep upsetting? Boosts inversely with Elo.",
    factor: (_, m) => teamFactor_underdog(m.elo),
  },
  {
    key: "uefa",
    label: "European dominance",
    Icon: Globe,
    description: "What if UEFA reasserts itself like 2010-2014?",
    factor: (_, m) => (m.confederation === "UEFA" ? 2.5 : 1),
  },
  {
    key: "conmebol",
    label: "South American renaissance",
    Icon: Earth,
    description: "Brazil + Argentina + Uruguay show up to play.",
    factor: (_, m) => (m.confederation === "CONMEBOL" ? 3.0 : 1),
  },
  {
    key: "host",
    label: "Host magic",
    Icon: Landmark,
    description: "USA, Canada, Mexico ride home crowds deep into the bracket.",
    factor: (_, m) => (m.host ? 4.0 : 1),
  },
  {
    key: "wildcard",
    label: "Wide-open tournament",
    Icon: Dices,
    description: "What if every team is a coin flip? Flattens probabilities toward uniform.",
    factor: () => 1, // handled specially via uniform blend
  },
];

function applyScenario(
  base: ChampionMap,
  metas: TeamMetas,
  scenario: Scenario,
  strength: number,
): ChampionMap {
  const teams = Object.keys(base);
  if (scenario.key === "wildcard") {
    const uniform = 1 / teams.length;
    const out: ChampionMap = {};
    for (const t of teams) {
      out[t] = (1 - strength) * base[t] + strength * uniform;
    }
    return out;
  }

  const blended: ChampionMap = {};
  let total = 0;
  for (const t of teams) {
    const f = scenario.factor(t, metas[t]);
    const blendedFactor = (1 - strength) * 1 + strength * f;
    const v = base[t] * blendedFactor;
    blended[t] = v;
    total += v;
  }
  if (total <= 0) return base;
  for (const t of teams) blended[t] /= total;
  return blended;
}

function pct(v: number, d = 1) {
  return `${(v * 100).toFixed(d)}%`;
}

export function ScenarioExplorer({
  baseChampion,
  metas,
}: {
  baseChampion: ChampionMap;
  metas: TeamMetas;
}) {
  const [scenarioKey, setScenarioKey] = useState("model");
  const [strength, setStrength] = useState(0.6);

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)!;
  const adjusted = useMemo(
    () => applyScenario(baseChampion, metas, scenario, strength),
    [baseChampion, metas, scenario, strength],
  );

  const top = Object.entries(adjusted)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const baseTop = Object.entries(baseChampion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SCENARIOS.map((s) => (
              <Button
                key={s.key}
                variant={s.key === scenarioKey ? "default" : "outline"}
                size="sm"
                onClick={() => setScenarioKey(s.key)}
                className="justify-start text-left h-auto py-2"
              >
                <div className="flex flex-col items-start">
                  <span className="flex items-center gap-1.5">
                    <s.Icon className="w-4 h-4 shrink-0" />
                    {s.label}
                  </span>
                </div>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{scenario.description}</p>

          {scenario.key !== "model" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">Scenario strength</span>
                <span className="font-mono tabular-nums">{(strength * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={strength * 100}
                onChange={(e) => setStrength(Number(e.target.value) / 100)}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Off (model only)</span>
                <span>Maximum scenario weight</span>
              </div>
            </div>
          )}

          <ul className="space-y-2 pt-2 border-t">
            {top.map(([team, p], i) => {
              const baseP = baseChampion[team] ?? 0;
              const delta = p - baseP;
              const baseRank = baseTop.indexOf(team);
              return (
                <li key={team} className="flex items-center gap-2 sm:gap-3 text-sm">
                  <span className="w-5 sm:w-6 text-center text-xs text-muted-foreground tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-base sm:text-lg shrink-0">{teamFlag(team)}</span>
                  <span className="flex-1 truncate font-medium min-w-0">{team}</span>
                  {baseRank !== -1 && baseRank !== i && (
                    <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                      {baseRank > i ? "↑" : "↓"} from #{baseRank + 1}
                    </Badge>
                  )}
                  <span className="font-mono text-xs tabular-nums w-12 sm:w-16 text-right shrink-0">
                    {pct(p, 2)}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums w-12 sm:w-14 text-right shrink-0 ${
                      delta > 0.001 ? "text-emerald-400" : delta < -0.001 ? "text-rose-400" : "text-muted-foreground"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {(delta * 100).toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
