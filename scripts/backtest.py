"""Run the back-test on the 2018 and 2022 World Cups."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.backtest import back_test_year
from wc2026.config import OUTPUT


def naive_baseline_brier(n: int = 64) -> tuple[float, float]:
    """Brier and log-loss for the 1/3-1/3-1/3 baseline."""
    p = 1 / 3
    # Each actual outcome gets one 1 and two 0s. Brier = (1-p)^2 + 2*p^2
    brier = (1 - p) ** 2 + 2 * p ** 2
    log_loss = -1 * (p > 0) * (- (1) * (1 - p) ** 0)  # -log(1/3) = 1.099
    import math
    log_loss = -math.log(p)
    return brier, log_loss


def main() -> None:
    naive_brier, naive_logloss = naive_baseline_brier()
    print(f"Baseline (1/3-1/3-1/3):  Brier={naive_brier:.3f}  log-loss={naive_logloss:.3f}")
    print()

    results = []
    for year in [2018, 2022]:
        print(f"=== Back-testing {year} World Cup ===")
        r = back_test_year(year)
        print(f"  n={r.n_matches}  Brier={r.brier:.3f}  log-loss={r.log_loss:.3f}  "
              f"accuracy={r.accuracy*100:.1f}%  goal-MAE={r.score_mae:.2f}")
        print()
        r.per_match.to_csv(OUTPUT / f"backtest_{year}.csv", index=False)
        results.append(r)

    print("=== Summary ===")
    print(f"{'Year':>6}  {'n':>3}  {'Brier':>7}  {'LogLoss':>8}  {'Acc':>6}  {'GoalMAE':>7}")
    for r in results:
        print(f"{r.year:>6}  {r.n_matches:>3}  {r.brier:>7.3f}  {r.log_loss:>8.3f}  "
              f"{r.accuracy*100:>5.1f}%  {r.score_mae:>7.2f}")
    print()
    print(f"Naive baseline:  Brier={naive_brier:.3f}  log-loss={naive_logloss:.3f}")
    target = 0.20
    print(f"Target: Brier ≤ {target} for well-calibrated model.")


if __name__ == "__main__":
    main()
