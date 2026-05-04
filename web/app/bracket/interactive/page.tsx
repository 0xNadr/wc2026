import { getResults } from "@/lib/data";
import { getMatchups } from "@/lib/matchups";
import { buildModalBracket } from "@/lib/bracket";
import { InteractiveBracket } from "./InteractiveBracket";

export default async function InteractiveBracketPage() {
  const r = await getResults();
  const mu = await getMatchups();
  const matches = buildModalBracket(r, mu);

  // Extract R32 starting teams as 16 pairs. Pre-compute the modal pick per
  // match using the same "stage-survival probability" rule as the modal
  // bracket — so the initial defaults end up with the actual most-likely
  // champion, not the head-to-head winner of the final pairing.
  const r16Probs = r.probabilities.round_of_16;
  const r32 = matches
    .filter((m) => m.stage === "R32")
    .map((m) => ({
      a: m.team_a,
      b: m.team_b,
      probA: m.cell.p_a,
      probB: m.cell.p_b,
      // Default pick = whoever the simulator more often advances to R16.
      defaultPick: ((r16Probs[m.team_a] ?? 0) >= (r16Probs[m.team_b] ?? 0) ? "a" : "b") as
        | "a"
        | "b",
    }));

  // Pass the matchup data so client can look up p_win for any picked pair
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Interactive bracket</h1>
        <p className="text-muted-foreground">
          Pick winners and watch them cascade. The default picks are the model's modal choice; tap
          a team to override. The probability shown is what the model gives for that team to win
          this specific matchup.
        </p>
      </section>
      <InteractiveBracket
        initialR32={r32}
        matchupsData={mu.matchups}
        nextStageProbs={{
          R16: r.probabilities.quarterfinal,
          QF: r.probabilities.semifinal,
          SF: r.probabilities.final,
          Final: r.probabilities.champion,
        }}
      />
    </div>
  );
}
