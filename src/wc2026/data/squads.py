"""Per-team current-roster strength index from EA FC 25 ratings.

Source: Kaggle aniss7/fifa-player-data-from-sofifa-2025-06-03 (downloaded via
kagglehub, no auth required for public datasets). The CSV exposes
`country_name` only for ~30 nations EA Sports has explicitly licensed; for the
remaining nations (notably Brazil, plus several CAF/AFC/CONCACAF teams)
players are bundled under the generic "Friendly International" entry. We
recover the real nationality for those players by parsing the `description`
field, which always reads "... is a {Nationality} footballer ...".
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..config import DATA_PROCESSED, DATA_RAW
from .matches import TEAM_NAME_MAP

PROCESSED = DATA_PROCESSED / "squad_strength.parquet"

# Phrase → canonical country name. The CSV's `description` field uses one of
# three patterns: "is a/an {demonym} footballer", "is a/an {demonym} soccer
# player" (US/AUS/SA usage), or "is a/an {full country name} footballer" for
# nations without a clean single-word demonym (Bosnia and Herzegovina, Curaçao,
# Democratic Republic of the Congo).
PHRASE_TO_COUNTRY = {
    # Demonyms
    "American": "United States", "Canadian": "Canada", "Mexican": "Mexico",
    "Panamanian": "Panama", "Haitian": "Haiti", "Curaçaoan": "Curaçao",
    "Argentine": "Argentina", "Argentinian": "Argentina", "Brazilian": "Brazil",
    "Uruguayan": "Uruguay", "Colombian": "Colombia", "Paraguayan": "Paraguay",
    "Ecuadorian": "Ecuador",
    "French": "France", "English": "England", "Spanish": "Spain",
    "German": "Germany", "Portuguese": "Portugal", "Dutch": "Netherlands",
    "Belgian": "Belgium", "Croatian": "Croatia", "Swiss": "Switzerland",
    "Austrian": "Austria", "Norwegian": "Norway", "Scottish": "Scotland",
    "Swedish": "Sweden", "Turkish": "Turkey", "Czech": "Czech Republic",
    "Bosnian": "Bosnia and Herzegovina", "Herzegovinian": "Bosnia and Herzegovina",
    "Moroccan": "Morocco", "Senegalese": "Senegal", "Egyptian": "Egypt",
    "Algerian": "Algeria", "Tunisian": "Tunisia", "Ghanaian": "Ghana",
    "Ivorian": "Ivory Coast", "Cape Verdean": "Cape Verde",
    "South African": "South Africa", "Congolese": "DR Congo",
    "Japanese": "Japan", "Korean": "South Korea", "South Korean": "South Korea",
    "Iranian": "Iran", "Australian": "Australia",
    "Saudi Arabian": "Saudi Arabia", "Saudi": "Saudi Arabia",
    "Qatari": "Qatar", "Jordanian": "Jordan",
    "Uzbek": "Uzbekistan", "Uzbekistani": "Uzbekistan",
    "Iraqi": "Iraq", "New Zealander": "New Zealand",
    # Full country names that appear in lieu of a demonym
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Curaçao": "Curaçao",
    "Democratic Republic of the Congo": "DR Congo",
    "New Zealand": "New Zealand",
    "Cape Verde": "Cape Verde",
}

# Sort phrases by length descending so longer multi-word matches win over
# single-word substrings (e.g. "South Korean" must match before "Korean").
_phrase_alts = "|".join(re.escape(p) for p in sorted(PHRASE_TO_COUNTRY, key=len, reverse=True))
DESC_RE = re.compile(
    rf"is\s+an?\s+({_phrase_alts})\s+(?:footballer|soccer\s+player)",
    re.IGNORECASE,
)


def _extract_nationality(description: str | float) -> str | None:
    if not isinstance(description, str):
        return None
    m = DESC_RE.search(description)
    if not m:
        return None
    matched = m.group(1)
    for phrase, country in PHRASE_TO_COUNTRY.items():
        if phrase.lower() == matched.lower():
            return country
    return None


def compute_squad_strength(player_csv: str | None = None) -> pd.DataFrame:
    """Aggregate per-nation squad strength from the sofifa player CSV.

    Resolution order for each player's nation:
      1. country_name when present and not "Friendly International"
      2. Demonym parsed from description (recovers Brazil, etc.)
    """
    src = DATA_RAW / "sofifa_players.csv" if player_csv is None else player_csv
    df = pd.read_csv(src, low_memory=False)

    nation = df["country_name"].where(
        df["country_name"].notna() & (df["country_name"] != "Friendly International")
    )
    fallback = df["description"].map(_extract_nationality)
    df["nation"] = nation.fillna(fallback)
    df["nation"] = df["nation"].replace(TEAM_NAME_MAP)

    df = df.dropna(subset=["nation", "overall_rating"])
    df["overall_rating"] = df["overall_rating"].astype(float)

    top23 = df.sort_values("overall_rating", ascending=False).groupby("nation").head(23)
    out = (
        top23.groupby("nation")
        .agg(
            squad_strength=("overall_rating", "mean"),
            squad_top11=("overall_rating", lambda s: s.nlargest(11).mean()),
            squad_n=("overall_rating", "size"),
        )
        .reset_index()
    )
    out.to_parquet(PROCESSED, index=False)
    return out
