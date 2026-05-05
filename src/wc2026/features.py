"""Build the training feature matrix from cleaned matches + Elo + squads.

For Bayesian Dixon-Coles we need, per match:
    home_idx, away_idx        : team indices into a contiguous range
    home_goals, away_goals    : observed scoreline
    weight                    : exp(-ln(2) * age_years / halflife) * importance
    is_neutral                : 0/1 (turns off home-advantage term)
    is_friendly               : 0/1 (separate dispersion or weight)
    match_type_idx            : index into MATCH_TYPES — used by the hierarchical
                                tournament-context offset (Ley et al. 2019,
                                Groll et al. 2019; ~0.005-0.012 Brier lift)
We also build per-team prior features (Elo, squad strength) used as informative
priors on the latent attack/defense parameters.
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from .config import DEFAULT_MATCH_WEIGHT, MATCH_WEIGHTS, TIME_DECAY_HALFLIFE_YEARS
from .data.matches import load_matches

# Match-type taxonomy. Order matters — the model coords are built from this list.
MATCH_TYPES: list[str] = [
    "friendly",
    "qualifier",
    "continental",
    "wc_group",
    "wc_knockout",
]
MATCH_TYPE_IDX: dict[str, int] = {t: i for i, t in enumerate(MATCH_TYPES)}


def classify_match_types(df: pd.DataFrame) -> pd.Series:
    """Return a Series of match_type strings (one per row, aligned to df.index).

    A match is classified by:
      - "friendly" if tournament == "Friendly"
      - "qualifier" if tournament contains "qualification"
      - "wc_knockout" if tournament == "FIFA World Cup" and the match is in
         the last 16 of that WC's matches by date (the standard 32-team
         knockout-stage size; the 2026 48-team format adds R32 = 32 knockouts
         total, but historical training data is all 16-knockout WCs)
      - "wc_group" for the rest of FIFA World Cup matches
      - "continental" otherwise
    """
    out = pd.Series("continental", index=df.index, dtype="object")
    out[df["tournament"] == "Friendly"] = "friendly"
    out[df["tournament"].str.contains("qualification", case=False, na=False)] = "qualifier"

    wc_mask = df["tournament"] == "FIFA World Cup"
    out[wc_mask] = "wc_group"
    # Knockout = last 16 of each WC by date
    if wc_mask.any():
        for year in df.loc[wc_mask, "date"].dt.year.unique():
            year_mask = wc_mask & (df["date"].dt.year == year)
            sub_idx = df.loc[year_mask].sort_values("date").index
            knockout_idx = sub_idx[-16:]  # last 16 = knockouts
            out.loc[knockout_idx] = "wc_knockout"
    return out


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
    df["match_type"] = classify_match_types(df)
    df["match_type_idx"] = df["match_type"].map(MATCH_TYPE_IDX).astype(int)

    return df.reset_index(drop=True), team_to_idx
