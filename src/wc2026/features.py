"""Build the training feature matrix from cleaned matches + Elo + squads.

For Bayesian Dixon-Coles we need, per match:
    home_idx, away_idx        : team indices into a contiguous range
    home_goals, away_goals    : observed scoreline
    weight                    : exp(-ln(2) * age_years / halflife) * importance
    is_neutral                : 0/1 (turns off home-advantage term)
    is_friendly               : 0/1 (separate dispersion or weight)
We also build per-team prior features (Elo, squad strength) used as informative
priors on the latent attack/defense parameters.
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from .config import DEFAULT_MATCH_WEIGHT, MATCH_WEIGHTS, TIME_DECAY_HALFLIFE_YEARS
from .data.matches import load_matches


def time_decay_weight(match_date: pd.Series, ref_date: date,
                       half_life_years: float | None = None) -> pd.Series:
    hl = half_life_years if half_life_years is not None else TIME_DECAY_HALFLIFE_YEARS
    age_years = (pd.Timestamp(ref_date) - match_date).dt.days / 365.25
    return np.exp(-np.log(2) * age_years / hl)


def importance_weight(tournament: pd.Series) -> pd.Series:
    return tournament.map(MATCH_WEIGHTS).fillna(DEFAULT_MATCH_WEIGHT)


def build_training_frame(
    teams: list[str],
    ref_date: date | None = None,
    min_year: int = 1970,
    half_life_years: float | None = None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Return (filtered_matches_with_weights, team_to_index).

    teams: the universe of teams to model (typically the 48 qualified + their
           historical opponents we want to inform priors).
    half_life_years: time-decay half-life. None falls back to config default.
    """
    ref_date = ref_date or date.today()
    df = load_matches()
    df = df[df["date"].dt.year >= min_year].copy()

    team_set = set(teams)
    df = df[df["home_team"].isin(team_set) & df["away_team"].isin(team_set)].copy()

    df["w_time"] = time_decay_weight(df["date"], ref_date, half_life_years=half_life_years)
    df["w_importance"] = importance_weight(df["tournament"])
    df["weight"] = df["w_time"] * df["w_importance"]

    team_to_idx = {t: i for i, t in enumerate(sorted(teams))}
    df["home_idx"] = df["home_team"].map(team_to_idx)
    df["away_idx"] = df["away_team"].map(team_to_idx)
    df["is_neutral"] = df["neutral"].astype(int)
    df["is_friendly"] = df["is_friendly"].astype(int)

    return df.reset_index(drop=True), team_to_idx
