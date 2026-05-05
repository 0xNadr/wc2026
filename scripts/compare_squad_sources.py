"""Side-by-side comparison of EA FC 25 vs Transfermarkt squad-strength priors.

Prints per-nation z-score deltas so you can see which teams the prior would
move (and by how much) before committing to a full retrain. Run:

    .venv/bin/python scripts/compare_squad_sources.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd

from wc2026.data.squads import compute_squad_strength
from wc2026.data.squads_tm import compute_squad_strength_tm
from wc2026.data.tournament import QUALIFIED_TEAMS


def main() -> None:
    ea = compute_squad_strength()[["nation", "squad_strength"]].rename(
        columns={"squad_strength": "ea_fc"})
    tm = compute_squad_strength_tm()[["nation", "squad_strength"]].rename(
        columns={"squad_strength": "tm_log_mv"})
    m = ea.merge(tm, on="nation", how="outer")
    m = m[m["nation"].isin(QUALIFIED_TEAMS)].copy()

    for col, z in [("ea_fc", "ea_z"), ("tm_log_mv", "tm_z")]:
        m[z] = (m[col] - m[col].mean()) / m[col].std()
    m["delta_z"] = m["tm_z"] - m["ea_z"]

    spearman = m[["ea_fc", "tm_log_mv"]].corr(method="spearman").iloc[0, 1]
    print(f"Spearman rank correlation: {spearman:.3f}\n")

    print("=== Biggest movers UP (TM ranks higher than EA FC) ===")
    print(m.dropna().sort_values("delta_z", ascending=False)
            .head(10)[["nation", "ea_z", "tm_z", "delta_z"]]
            .to_string(index=False, float_format=lambda x: f"{x:+.2f}"))

    print("\n=== Biggest movers DOWN (TM ranks lower than EA FC) ===")
    print(m.dropna().sort_values("delta_z")
            .head(10)[["nation", "ea_z", "tm_z", "delta_z"]]
            .to_string(index=False, float_format=lambda x: f"{x:+.2f}"))

    print("\n=== Top 12 by each metric ===")
    top_ea = m.dropna().sort_values("ea_fc", ascending=False).head(12)["nation"].tolist()
    top_tm = m.dropna().sort_values("tm_log_mv", ascending=False).head(12)["nation"].tolist()
    for i, (a, b) in enumerate(zip(top_ea, top_tm), 1):
        marker = "" if a == b else "  ←"
        print(f"  {i:>2}. EA: {a:<20} TM: {b}{marker}")


if __name__ == "__main__":
    main()
