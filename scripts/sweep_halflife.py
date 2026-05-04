"""Cross-validate the time-decay half-life on past World Cups.

Sweeps the half-life parameter and re-runs the back-test for each value,
reporting Brier / log-loss / accuracy. The winner becomes the production
default.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.backtest import back_test_year
from wc2026.config import OUTPUT


HALFLIVES = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]


def main() -> None:
    rows = []
    for hl in HALFLIVES:
        print(f"\n=== Half-life = {hl} years ===")
        per_year = []
        for year in [2018, 2022]:
            r = back_test_year(year, half_life_years=hl,
                               draws=600, tune=600, chains=2)
            print(f"  [{year}] Brier={r.brier:.4f}  log-loss={r.log_loss:.4f}  "
                  f"acc={r.accuracy*100:.1f}%")
            per_year.append({
                "year": year, "n": r.n_matches, "brier": r.brier,
                "log_loss": r.log_loss, "accuracy": r.accuracy,
                "goal_mae": r.score_mae,
            })
        avg_brier = sum(x["brier"] for x in per_year) / 2
        avg_logloss = sum(x["log_loss"] for x in per_year) / 2
        rows.append({
            "half_life_years": hl,
            "avg_brier": avg_brier,
            "avg_log_loss": avg_logloss,
            "per_year": per_year,
        })

    # Pick best by Brier
    best = min(rows, key=lambda r: r["avg_brier"])
    print(f"\n=== Sweep Summary (sorted by avg Brier) ===")
    print(f"  {'HL (yr)':>8s}  {'avg Brier':>10s}  {'avg LogLoss':>12s}")
    for r in sorted(rows, key=lambda x: x["avg_brier"]):
        marker = "  ←" if r is best else ""
        print(f"  {r['half_life_years']:>7.1f}   "
              f"{r['avg_brier']:>9.4f}    {r['avg_log_loss']:>11.4f}{marker}")
    print(f"\nBest half-life: {best['half_life_years']}y "
          f"(avg Brier {best['avg_brier']:.4f})")

    out = OUTPUT / "halflife_sweep.json"
    out.write_text(json.dumps({"results": rows, "best": best}, indent=2))
    print(f"✓ Wrote {out}")


if __name__ == "__main__":
    main()
