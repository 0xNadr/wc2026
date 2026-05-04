"""Fetch current Elo ratings for national teams from eloratings.net.

Uses the site's published TSV (https://www.eloratings.net/World.tsv) which
returns the full ranking table; columns 2 and 3 are ISO code and current Elo.
"""
from __future__ import annotations

import csv
import json

import requests

from ..config import DATA_RAW

ELO_TSV_URL = "https://www.eloratings.net/World.tsv"
ELO_RAW = DATA_RAW / "elo_world.tsv"
ELO_SNAPSHOT = DATA_RAW / "elo_ratings.json"

# eloratings.net uses 2-letter codes; UK home nations and a few others differ
# from ISO 3166-1 alpha-2.
ISO_TO_TEAM: dict[str, str] = {
    "US": "United States", "CA": "Canada", "MX": "Mexico",
    "PA": "Panama", "HT": "Haiti", "CW": "Curaçao",
    "AR": "Argentina", "BR": "Brazil", "UY": "Uruguay", "CO": "Colombia",
    "PY": "Paraguay", "EC": "Ecuador",
    "FR": "France", "EN": "England", "ES": "Spain", "DE": "Germany",
    "PT": "Portugal", "NL": "Netherlands", "BE": "Belgium", "HR": "Croatia",
    "CH": "Switzerland", "AT": "Austria", "NO": "Norway", "SC": "Scotland",
    "SE": "Sweden", "TR": "Turkey", "CZ": "Czech Republic",
    "BA": "Bosnia and Herzegovina",
    "MA": "Morocco", "SN": "Senegal", "EG": "Egypt", "DZ": "Algeria",
    "TN": "Tunisia", "GH": "Ghana", "CI": "Ivory Coast", "CV": "Cape Verde",
    "ZA": "South Africa", "CD": "DR Congo",
    "JP": "Japan", "KR": "South Korea", "IR": "Iran", "AU": "Australia",
    "SA": "Saudi Arabia", "QA": "Qatar", "JO": "Jordan", "UZ": "Uzbekistan",
    "IQ": "Iraq",
    "NZ": "New Zealand",
}


def _download_tsv(refresh: bool) -> None:
    if ELO_RAW.exists() and not refresh:
        return
    r = requests.get(ELO_TSV_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    r.raise_for_status()
    ELO_RAW.write_bytes(r.content)


def fetch_elo_ratings(refresh: bool = False) -> dict[str, float]:
    """Return {canonical_team_name: elo_rating} for all teams the TSV exposes."""
    if ELO_SNAPSHOT.exists() and not refresh:
        return json.loads(ELO_SNAPSHOT.read_text())

    _download_tsv(refresh)
    ratings: dict[str, float] = {}
    with ELO_RAW.open() as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 4:
                continue
            iso = row[2]
            try:
                rating = float(row[3])
            except ValueError:
                continue
            team = ISO_TO_TEAM.get(iso)
            if team:
                ratings[team] = rating

    ELO_SNAPSHOT.write_text(json.dumps(ratings, indent=2, sort_keys=True))
    return ratings
