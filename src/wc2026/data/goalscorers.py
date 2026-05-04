"""Per-goal scorer/minute records from martj42 international goalscorers dataset.

Source: https://github.com/martj42/international_results (goalscorers.csv on main).
Schema: date, home_team, away_team, team, scorer, minute, own_goal, penalty.

Used to estimate each player's share of their nation's goals — the input to a
naive Golden Boot prediction (player_goals = share × team_total_goals).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

from ..config import DATA_PROCESSED, DATA_RAW
from .matches import TEAM_NAME_MAP

GOALSCORERS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/goalscorers.csv"
RAW = DATA_RAW / "goalscorers.csv"
PROCESSED = DATA_PROCESSED / "goalscorers.parquet"


def _download(dest: Path) -> None:
    if dest.exists():
        return
    r = requests.get(GOALSCORERS_URL, timeout=60)
    r.raise_for_status()
    dest.write_bytes(r.content)


def download_raw() -> None:
    _download(RAW)


def load_goalscorers(refresh: bool = False) -> pd.DataFrame:
    """Return cleaned goalscorer records with canonical team names.

    Columns: date, home_team, away_team, team, scorer, minute, own_goal, penalty
    Own-goals are *kept* in the frame but tagged — callers should drop them
    when computing scoring shares (they don't count toward Golden Boot).
    """
    if PROCESSED.exists() and not refresh:
        return pd.read_parquet(PROCESSED)

    download_raw()
    df = pd.read_csv(RAW, parse_dates=["date"])
    df["home_team"] = df["home_team"].replace(TEAM_NAME_MAP)
    df["away_team"] = df["away_team"].replace(TEAM_NAME_MAP)
    df["team"] = df["team"].replace(TEAM_NAME_MAP)
    df["own_goal"] = df["own_goal"].astype(bool)
    df["penalty"] = df["penalty"].astype(bool)
    df["scorer"] = df["scorer"].astype(str).str.strip()
    df.to_parquet(PROCESSED, index=False)
    return df


def scorer_shares(
    df: pd.DataFrame,
    teams: list[str],
    *,
    since: str = "2022-01-01",
    half_life_years: float = 1.5,
) -> pd.DataFrame:
    """Per-team per-player share of team goals over a recent window.

    Uses an exponential decay so post-2024 form weighs more than 2022. Excludes
    own goals. Penalties are kept (they count toward Golden Boot).

    Returns columns: team, scorer, weighted_goals, share, n_recent_goals.
    """
    cutoff = pd.Timestamp(since)
    recent = df[(df["date"] >= cutoff) & (~df["own_goal"]) & (df["team"].isin(teams))].copy()
    if recent.empty:
        return pd.DataFrame(columns=["team", "scorer", "weighted_goals", "share", "n_recent_goals"])

    age_years = (recent["date"].max() - recent["date"]).dt.days / 365.25
    recent["w"] = 0.5 ** (age_years / half_life_years)

    grouped = (
        recent.groupby(["team", "scorer"], as_index=False)
        .agg(weighted_goals=("w", "sum"), n_recent_goals=("w", "size"))
    )
    team_totals = grouped.groupby("team")["weighted_goals"].sum().rename("team_total")
    grouped = grouped.join(team_totals, on="team")
    grouped["share"] = grouped["weighted_goals"] / grouped["team_total"]
    grouped = grouped.drop(columns="team_total")
    return grouped.sort_values(["team", "share"], ascending=[True, False]).reset_index(drop=True)
