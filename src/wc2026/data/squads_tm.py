"""Per-team squad strength from Transfermarkt market values (prototype).

Drop-in alternative to ``squads.compute_squad_strength``: produces the same
``nation`` / ``squad_strength`` schema, so the Bayesian prior in
``model.bayesian.build_priors`` will z-score-normalize and blend it the same way.

Source: dcaribou/transfermarkt-datasets, refreshed weekly. The single CSV at
``players.csv.gz`` carries ``country_of_citizenship`` and
``market_value_in_eur`` for ~47k players, which is enough to build a top-23
squad-strength index per nation purely from publicly-licensed transfer-market
valuations — no game purchase, no annual snapshot lag.

Aggregation: log10(market value) averaged over the top-N players per nation
(default 23). Logging tames the long tail (Mbappe vs a back-up keeper) so the
mean is not dominated by a single star, which mirrors the dynamic range of the
EA FC overall_rating (~70-90) the prior was originally tuned against.
"""
from __future__ import annotations

import gzip
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from ..config import DATA_PROCESSED, DATA_RAW
from .matches import TEAM_NAME_MAP

PLAYERS_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz"
RAW_GZ = DATA_RAW / "tm_players.csv.gz"
RAW_CSV = DATA_RAW / "tm_players.csv"
PROCESSED = DATA_PROCESSED / "squad_strength_tm.parquet"

# Transfermarkt-specific spellings on top of the canonical TEAM_NAME_MAP. TM's
# ``country_of_citizenship`` uses English exonyms that don't always agree with
# the Wikidata-style names the matches dataset uses.
TM_NAME_MAP = {
    **TEAM_NAME_MAP,
    "Korea, South": "South Korea",
    "Korea, North": "North Korea",
    "Cote d'Ivoire": "Ivory Coast",
    "Curacao": "Curaçao",
    "Czech Republic": "Czech Republic",
}


def _download() -> None:
    if RAW_CSV.exists():
        return
    RAW_GZ.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(PLAYERS_URL, stream=True, timeout=120) as r:
        r.raise_for_status()
        with RAW_GZ.open("wb") as f:
            shutil.copyfileobj(r.raw, f)
    with gzip.open(RAW_GZ, "rb") as src, RAW_CSV.open("wb") as dst:
        shutil.copyfileobj(src, dst)


def compute_squad_strength_tm(top_n: int = 23) -> pd.DataFrame:
    """Aggregate per-nation squad strength from Transfermarkt market values.

    A player counts toward their nation's pool if they have any international
    caps OR are currently rostered (``current_national_team_id`` is set). The
    top-``top_n`` by market value per nation are averaged on a log10 scale.
    """
    _download()
    df = pd.read_csv(RAW_CSV, low_memory=False)

    df["nation"] = df["country_of_citizenship"].replace(TM_NAME_MAP)
    eligible = (df["international_caps"].fillna(0) > 0) | df["current_national_team_id"].notna()
    df = df[eligible].dropna(subset=["nation", "market_value_in_eur"])
    df = df[df["market_value_in_eur"] > 0]
    df["log_mv"] = np.log10(df["market_value_in_eur"])

    top = df.sort_values("market_value_in_eur", ascending=False).groupby("nation").head(top_n)
    out = (
        top.groupby("nation")
        .agg(
            squad_strength=("log_mv", "mean"),
            squad_top11=("log_mv", lambda s: s.nlargest(11).mean()),
            squad_n=("log_mv", "size"),
            squad_total_mv_eur=("market_value_in_eur", "sum"),
        )
        .reset_index()
    )
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(PROCESSED, index=False)
    return out


if __name__ == "__main__":
    df = compute_squad_strength_tm()
    print(df.sort_values("squad_strength", ascending=False).head(20).to_string(index=False))
