"""Blended per-player goal-share model: historical evidence + FC 25 prior.

For each (team, player), we compute an effective share of team goals as a
Dirichlet-Multinomial conjugate update:

    eff_goals[p] = hist_weighted_goals[p] + α · team_total_hist · fc25_share[p]
    share[p]     = eff_goals[p] / Σ_q eff_goals[q]

which simplifies to a weighted average of two shares:

    share[p] = (1 / (1 + α)) · hist_share[p] + (α / (1 + α)) · fc25_share[p]

α controls how strongly the FC 25 prior pulls the historical signal. α=0.5
adds half a "team's worth" of pseudo-data — meaningful for emergers (Yamal,
Wirtz, Endrick) without overwhelming established scorers (Mbappé, Kane).

Player matching across the two sources uses normalized name equality with a
token-subset fallback (see data/players.py:match_scorer_to_fc25). Players who
appear in only one source still contribute: history-only players get
fc25_share=0; FC25-only players get hist_share=0.
"""
from __future__ import annotations

import pandas as pd

from ..data.goalscorers import load_goalscorers, scorer_shares
from ..data.players import _normalize_name, fc25_share, match_scorer_to_fc25

DEFAULT_ALPHA = 0.5
DEFAULT_SQUAD_SIZE = 30
DEFAULT_SINCE = "2022-01-01"
DEFAULT_HALFLIFE = 1.5


def _blend_one_team(
    team: str,
    hist_team: pd.DataFrame,
    fc25_team: pd.DataFrame,
    alpha: float,
) -> pd.DataFrame:
    fc25_keyed = fc25_team[
        ["player_id", "name", "fc25_share", "attacking_quality"]
    ].copy()
    fc25_keyed["key"] = fc25_keyed["player_id"].astype(str)
    fc25_keyed = fc25_keyed.rename(columns={"name": "display_name"})
    fc25_keyed = fc25_keyed[["key", "display_name", "fc25_share", "attacking_quality"]]

    hist_team = hist_team.copy()
    hist_team["scorer_norm"] = hist_team["scorer"].map(_normalize_name)
    matched_keys = [
        match_scorer_to_fc25(s, fc25_team) for s in hist_team["scorer_norm"]
    ]
    hist_team["key"] = pd.Series(
        [
            str(k) if k is not None else f"hist:{name}"
            for k, name in zip(matched_keys, hist_team["scorer"])
        ],
        index=hist_team.index,
        dtype="string",
    )

    if hist_team.empty:
        hist_grouped = pd.DataFrame({
            "key": pd.Series(dtype="string"),
            "hist_display_name": pd.Series(dtype="string"),
            "weighted_goals": pd.Series(dtype="float64"),
            "n_recent_goals": pd.Series(dtype="int64"),
        })
    else:
        hist_grouped = (
            hist_team.groupby("key")
            .agg(
                hist_display_name=("scorer", "first"),
                weighted_goals=("weighted_goals", "sum"),
                n_recent_goals=("n_recent_goals", "sum"),
            )
            .reset_index()
        )
        hist_grouped["key"] = hist_grouped["key"].astype("string")
    fc25_keyed["key"] = fc25_keyed["key"].astype("string")

    merged = fc25_keyed.merge(hist_grouped, on="key", how="outer")
    merged["display_name"] = merged["hist_display_name"].fillna(merged["display_name"])
    merged["fc25_share"] = merged["fc25_share"].fillna(0.0)
    merged["attacking_quality"] = merged["attacking_quality"].fillna(0.0)
    merged["weighted_goals"] = merged["weighted_goals"].fillna(0.0)
    merged["n_recent_goals"] = merged["n_recent_goals"].fillna(0).astype(int)

    team_total_hist = merged["weighted_goals"].sum()
    merged["hist_share"] = (
        merged["weighted_goals"] / team_total_hist if team_total_hist > 0 else 0.0
    )

    merged["blended_share"] = (
        (1.0 / (1.0 + alpha)) * merged["hist_share"]
        + (alpha / (1.0 + alpha)) * merged["fc25_share"]
    )
    merged["team"] = team
    merged["scorer"] = merged["display_name"]

    return merged[[
        "team", "scorer", "key", "weighted_goals", "n_recent_goals",
        "hist_share", "fc25_share", "attacking_quality", "blended_share",
    ]]


def blended_shares(
    teams: list[str],
    *,
    alpha: float = DEFAULT_ALPHA,
    squad_size: int = DEFAULT_SQUAD_SIZE,
    since: str = DEFAULT_SINCE,
    half_life_years: float = DEFAULT_HALFLIFE,
) -> pd.DataFrame:
    """Per-team per-player blended share table (union of historical + FC25)."""
    gs = load_goalscorers()
    hist = scorer_shares(gs, teams=teams, since=since, half_life_years=half_life_years)
    fc25 = fc25_share(squad_size=squad_size)
    fc25 = fc25[fc25["nation"].isin(teams)]

    rows: list[pd.DataFrame] = []
    for team in teams:
        team_fc25 = fc25[fc25["nation"] == team].reset_index(drop=True)
        team_hist = hist[hist["team"] == team]
        rows.append(_blend_one_team(team, team_hist, team_fc25, alpha))

    return pd.concat(rows, ignore_index=True)
