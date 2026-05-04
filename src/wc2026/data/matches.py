"""Load and clean the martj42 international match results dataset.

Source: https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017
Mirror used here: https://github.com/martj42/international_results (raw CSV on main branch)
"""
from __future__ import annotations

import io
from pathlib import Path

import pandas as pd
import requests

from ..config import DATA_PROCESSED, DATA_RAW

RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
SHOOTOUTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/shootouts.csv"

RAW_RESULTS = DATA_RAW / "results.csv"
RAW_SHOOTOUTS = DATA_RAW / "shootouts.csv"
PROCESSED = DATA_PROCESSED / "matches.parquet"

# Canonicalize team-name variants so the same nation has one identity across
# different historical epochs and sources (martj42 vs eloratings vs sofifa).
TEAM_NAME_MAP = {
    "USA": "United States",
    "Korea Republic": "South Korea",
    "Korea DPR": "North Korea",
    "Republic of Ireland": "Ireland",
    "IR Iran": "Iran",
    "Cape Verde Islands": "Cape Verde",
    "Côte d'Ivoire": "Ivory Coast",
    "Curacao": "Curaçao",
    "Czechia": "Czech Republic",
    "Türkiye": "Turkey",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "Congo DR": "DR Congo",
}


def _download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    dest.write_bytes(r.content)


def download_raw() -> None:
    _download(RESULTS_URL, RAW_RESULTS)
    _download(SHOOTOUTS_URL, RAW_SHOOTOUTS)


def load_matches(refresh: bool = False) -> pd.DataFrame:
    """Return cleaned match dataframe with canonical team names.

    Columns: date, home_team, away_team, home_score, away_score,
             tournament, city, country, neutral, is_friendly
    """
    if PROCESSED.exists() and not refresh:
        return pd.read_parquet(PROCESSED)

    download_raw()
    df = pd.read_csv(RAW_RESULTS, parse_dates=["date"])
    df["home_team"] = df["home_team"].replace(TEAM_NAME_MAP)
    df["away_team"] = df["away_team"].replace(TEAM_NAME_MAP)
    df["is_friendly"] = df["tournament"].str.lower().eq("friendly")
    df["neutral"] = df["neutral"].astype(bool)
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    df.to_parquet(PROCESSED, index=False)
    return df
