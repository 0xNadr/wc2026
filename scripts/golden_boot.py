"""Baseline Golden Boot ranking.

Reads the trained Dixon-Coles trace + the existing tournament-simulation output
and combines them with historical scorer shares to rank players by expected
tournament goals. See src/wc2026/model/golden_boot.py for caveats.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import OUTPUT
from wc2026.model.bayesian import load_trace
from wc2026.model.golden_boot import golden_boot_probabilities, golden_boot_table


def main(top_k: int = 30, n_sims: int = 20_000) -> None:
    trace = load_trace("dixon_coles")
    table = golden_boot_table(trace, top_k=top_k)

    out_csv = OUTPUT / "golden_boot.csv"
    out_json = OUTPUT / "golden_boot.json"
    table.to_csv(out_csv, index=False)
    table.to_json(out_json, orient="records", force_ascii=False, indent=2)

    print(f"Top {top_k} expected goal-scorers (history × FC 25 blend):")
    print(f"  {'rk':>3} {'scorer':<28s} {'team':<20s} "
          f"{'hist':>5s} {'fc25':>5s} {'blend':>5s} "
          f"{'team_xG':>7s} {'xGoals':>7s}")
    for _, r in table.iterrows():
        print(f"  {int(r['rank']):>3} {str(r['scorer'])[:28]:<28s} "
              f"{str(r['team'])[:20]:<20s} "
              f"{r['hist_share']:>4.1%} {r['fc25_share']:>4.1%} "
              f"{r['blended_share']:>4.1%} "
              f"{r['expected_team_goals']:>7.2f} "
              f"{r['expected_player_goals']:>7.2f}")
    print(f"\n✓ Wrote {out_csv}")

    print(f"\nRunning {n_sims:,} Monte Carlo sims for P(Golden Boot)...")
    prob_table = golden_boot_probabilities(trace, n_sims=n_sims, top_k=top_k)

    out_prob_csv = OUTPUT / "golden_boot_probabilities.csv"
    out_prob_json = OUTPUT / "golden_boot_probabilities.json"
    prob_table.to_csv(out_prob_csv, index=False)
    prob_table.to_json(out_prob_json, orient="records", force_ascii=False, indent=2)

    print(f"\nTop {top_k} by P(Golden Boot):")
    print(f"  {'rk':>3} {'scorer':<28s} {'team':<20s} "
          f"{'share':>5s} {'team_xG':>7s} {'xGoals':>7s} {'P(GB)':>6s}")
    for _, r in prob_table.iterrows():
        print(f"  {int(r['rank']):>3} {str(r['scorer'])[:28]:<28s} "
              f"{str(r['team'])[:20]:<20s} "
              f"{r['blended_share']:>4.1%} "
              f"{r['expected_team_goals']:>7.2f} "
              f"{r['expected_player_goals']:>7.2f} "
              f"{r['p_top_scorer']:>5.1%}")
    print(f"\n✓ Wrote {out_prob_csv}")


if __name__ == "__main__":
    main()
