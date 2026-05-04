"""Produce a small EDA chart pack from the matches dataset.

Saves ~10 PNGs to output/eda/ that the web app can render on an /eda page.
All charts use a dark theme (matches the site palette).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from wc2026.config import OUTPUT
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.matches import load_matches
from wc2026.data.tournament import QUALIFIED_TEAMS

OUT_DIR = OUTPUT / "eda"
OUT_DIR.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "figure.facecolor": "#0a0a0a",
    "axes.facecolor": "#141414",
    "axes.edgecolor": "#404040",
    "axes.labelcolor": "#d4d4d4",
    "xtick.color": "#a3a3a3",
    "ytick.color": "#a3a3a3",
    "text.color": "#d4d4d4",
    "savefig.facecolor": "#0a0a0a",
    "savefig.dpi": 110,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.spines.top": False,
    "axes.spines.right": False,
})

EMERALD = "#10b981"
AMBER = "#f59e0b"
ROSE = "#f43f5e"
SLATE = "#64748b"
PALETTE = [EMERALD, "#3b82f6", AMBER, ROSE, "#8b5cf6", "#ec4899"]


def save(fig: plt.Figure, name: str) -> None:
    fig.tight_layout()
    fig.savefig(OUT_DIR / name, dpi=110, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {name}")


def main() -> None:
    df = load_matches()
    df = df[df["date"].dt.year >= 1990]
    elo = fetch_elo_ratings()
    qualified = sorted(QUALIFIED_TEAMS.keys())

    # 1. Goals per match distribution
    fig, ax = plt.subplots(figsize=(8, 4))
    total_goals = df["home_score"] + df["away_score"]
    ax.hist(total_goals, bins=range(0, 12), color=EMERALD, alpha=0.85, edgecolor="#0a0a0a")
    ax.axvline(total_goals.mean(), color=AMBER, linestyle="--", linewidth=2,
               label=f"mean = {total_goals.mean():.2f}")
    ax.set_title("Total goals per international match (1990 → present)")
    ax.set_xlabel("Goals"); ax.set_ylabel("Matches")
    ax.legend()
    save(fig, "01_goals_per_match.png")

    # 2. Home advantage: home goals vs away goals
    fig, ax = plt.subplots(figsize=(8, 4))
    non_neutral = df[~df["neutral"]]
    avg_home = non_neutral["home_score"].mean()
    avg_away = non_neutral["away_score"].mean()
    ax.bar(["Home", "Away"], [avg_home, avg_away], color=[EMERALD, ROSE], width=0.5)
    ax.set_title(f"Home advantage at non-neutral venues: home scores {avg_home - avg_away:.2f} more goals")
    ax.set_ylabel("Average goals/match")
    for i, v in enumerate([avg_home, avg_away]):
        ax.text(i, v + 0.02, f"{v:.2f}", ha="center", fontweight="bold")
    save(fig, "02_home_advantage.png")

    # 3. Goals trend over time
    fig, ax = plt.subplots(figsize=(9, 4))
    yearly = df.groupby(df["date"].dt.year).apply(
        lambda g: (g["home_score"] + g["away_score"]).mean(), include_groups=False)
    ax.plot(yearly.index, yearly.values, color=EMERALD, linewidth=2, marker="o", markersize=4)
    ax.set_title("Goals per match by year (international football, 1990 →)")
    ax.set_xlabel("Year"); ax.set_ylabel("Avg goals/match")
    ax.grid(True, alpha=0.2)
    save(fig, "03_goals_trend.png")

    # 4. Result distribution: home win / draw / away win at non-neutral
    fig, ax = plt.subplots(figsize=(7, 4))
    for label, sub in [("Non-neutral", non_neutral), ("Neutral", df[df["neutral"]])]:
        results = pd.Series([
            (sub["home_score"] > sub["away_score"]).mean(),
            (sub["home_score"] == sub["away_score"]).mean(),
            (sub["home_score"] < sub["away_score"]).mean(),
        ], index=["Home win", "Draw", "Away win"])
        ax.bar([f"{x}\n({label})" for x in results.index], results.values,
               color=[EMERALD, AMBER, ROSE], alpha=0.7 if label == "Neutral" else 1.0)
    ax.set_title("Result distribution: home advantage clearly visible at non-neutral venues")
    ax.set_ylabel("Proportion")
    save(fig, "04_result_distribution.png")

    # 5. Elo ratings of all 48 qualified teams
    fig, ax = plt.subplots(figsize=(9, 11))
    ranked = sorted(qualified, key=lambda t: elo.get(t, 1500.0))
    ratings = [elo.get(t, 1500.0) for t in ranked]
    ax.barh(ranked, ratings, color=[EMERALD if r >= 1900 else AMBER if r >= 1750 else SLATE for r in ratings])
    ax.set_title("Current Elo of all 48 qualified WC2026 teams")
    ax.set_xlabel("Elo rating")
    ax.set_xlim(left=min(ratings) - 50)
    save(fig, "05_elo_qualified_teams.png")

    # 6. Elo distribution by confederation
    fig, ax = plt.subplots(figsize=(8, 4))
    confs = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"]
    data = []
    for c in confs:
        teams_in = [t for t in qualified if QUALIFIED_TEAMS[t]["confederation"] == c]
        data.append([elo.get(t, 1500.0) for t in teams_in])
    bp = ax.boxplot(data, labels=confs, patch_artist=True, widths=0.6)
    for patch, color in zip(bp["boxes"], PALETTE):
        patch.set_facecolor(color); patch.set_alpha(0.7)
    for whisker in bp["whiskers"]: whisker.set_color("#a3a3a3")
    for cap in bp["caps"]: cap.set_color("#a3a3a3")
    for median in bp["medians"]: median.set_color("white"); median.set_linewidth(2)
    ax.set_title("Elo distribution by confederation (qualified teams only)")
    ax.set_ylabel("Elo rating")
    save(fig, "06_elo_by_confederation.png")

    # 7. Top 10 most-played international rivalries
    pairs = pd.Series([
        tuple(sorted([h, a])) for h, a in zip(df["home_team"], df["away_team"])
    ]).value_counts().head(10)
    fig, ax = plt.subplots(figsize=(8, 5))
    labels = [f"{a} vs {b}" for (a, b) in pairs.index]
    ax.barh(labels[::-1], pairs.values[::-1], color=EMERALD)
    ax.set_title("Top 10 most-played international rivalries (since 1990)")
    ax.set_xlabel("Matches")
    save(fig, "07_top_rivalries.png")

    # 8. Match volume by tournament type
    fig, ax = plt.subplots(figsize=(8, 5))
    tour_counts = df["tournament"].value_counts().head(10)
    ax.barh(tour_counts.index[::-1], tour_counts.values[::-1], color=AMBER)
    ax.set_title("Most common tournament types in training data")
    ax.set_xlabel("Matches")
    save(fig, "08_tournament_volume.png")

    # 9. Friendly vs competitive: goal averages
    fig, ax = plt.subplots(figsize=(7, 4))
    friendly = df[df["is_friendly"]]
    competitive = df[~df["is_friendly"]]
    f_goals = (friendly["home_score"] + friendly["away_score"]).mean()
    c_goals = (competitive["home_score"] + competitive["away_score"]).mean()
    ax.bar(["Competitive", "Friendly"], [c_goals, f_goals],
           color=[EMERALD, AMBER], width=0.5)
    for i, v in enumerate([c_goals, f_goals]):
        ax.text(i, v + 0.02, f"{v:.2f}", ha="center", fontweight="bold")
    ax.set_title(f"Friendlies score {f_goals - c_goals:.2f} more goals/match than competitive")
    ax.set_ylabel("Avg goals/match")
    save(fig, "09_friendly_vs_competitive.png")

    # 10. Decade comparison
    fig, ax = plt.subplots(figsize=(8, 4))
    df["decade"] = (df["date"].dt.year // 10) * 10
    decade_stats = df.groupby("decade").apply(
        lambda g: pd.Series({
            "matches": len(g),
            "goals_per_match": (g["home_score"] + g["away_score"]).mean(),
            "draw_rate": (g["home_score"] == g["away_score"]).mean(),
        }), include_groups=False).reset_index()
    ax2 = ax.twinx()
    ax.bar(decade_stats["decade"], decade_stats["goals_per_match"],
           color=EMERALD, alpha=0.7, width=6, label="Goals/match")
    ax2.plot(decade_stats["decade"], decade_stats["draw_rate"] * 100,
             color=ROSE, linewidth=2, marker="o", label="Draw rate %")
    ax.set_xlabel("Decade")
    ax.set_ylabel("Goals/match", color=EMERALD)
    ax2.set_ylabel("Draw rate %", color=ROSE)
    ax.set_title("Goal-scoring and draw rates by decade")
    save(fig, "10_decade_comparison.png")

    print(f"\nWrote {len(list(OUT_DIR.glob('*.png')))} charts to {OUT_DIR}/")


if __name__ == "__main__":
    main()
