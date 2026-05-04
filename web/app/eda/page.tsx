import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CHARTS = [
  { src: "/eda/01_goals_per_match.png", title: "Goals per match distribution",
    note: "Most international matches finish with 2-3 goals total. Heavy tail thanks to occasional 7+ goal blowouts." },
  { src: "/eda/02_home_advantage.png", title: "Home advantage at non-neutral venues",
    note: "Home teams score ~0.4 more goals per match. The single biggest reason WC venue assignment matters." },
  { src: "/eda/03_goals_trend.png", title: "Goals per match by year",
    note: "Slight downward trend through the 2010s; stabilizing in the 2020s as elite defensive blocks become universal." },
  { src: "/eda/04_result_distribution.png", title: "Result distribution: home advantage visible",
    note: "Home teams win ~52% at non-neutral venues, ~37% at neutral. Draw rate is roughly stable around 25%." },
  { src: "/eda/05_elo_qualified_teams.png", title: "Elo of all 48 WC2026 teams",
    note: "Spain, Argentina, France lead. Curaçao and Cape Verde are in tournament-debut territory." },
  { src: "/eda/06_elo_by_confederation.png", title: "Elo by confederation",
    note: "UEFA's median is highest, but CONMEBOL teams (only 6 qualifying) are much more concentrated at the top." },
  { src: "/eda/07_top_rivalries.png", title: "Most-played international rivalries since 1990",
    note: "Long running CONMEBOL pairings dominate. These 10 fixtures are responsible for ~5% of all training data." },
  { src: "/eda/08_tournament_volume.png", title: "Where the matches come from",
    note: "Friendlies dominate volume. Why we down-weight them with `MATCH_WEIGHTS` in the model." },
  { src: "/eda/09_friendly_vs_competitive.png", title: "Friendlies are higher-scoring",
    note: "Managers experiment, defensive intensity is lower. Confirms the calibration choice to weight friendlies less." },
  { src: "/eda/10_decade_comparison.png", title: "Goal-scoring and draw rates by decade",
    note: "Modern football is slightly less goal-rich than the 90s but draw rate has barely budged." },
];

export default function EdaPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">EDA: data exploration</h1>
        <p className="text-muted-foreground">
          Patterns in the 49,256 match international dataset that informed the model. What the
          training data actually looks like before we Bayesian it.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CHARTS.map((c) => (
          <Card key={c.src}>
            <CardHeader>
              <CardTitle className="text-base">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Image
                src={c.src}
                alt={c.title}
                width={900}
                height={500}
                className="rounded-md w-full h-auto"
                unoptimized
              />
              <p className="text-xs text-muted-foreground">{c.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
