"""Per-player attacking-quality index from FC 25 attributes.

The Golden Boot baseline weights players only by their *historical* share of
team goals — that under-counts emergers (Yamal, Wirtz, Endrick) who haven't
had time to accumulate international goals yet. This module derives a
position-weighted attacking-quality score per player and exposes a
share-shaped vector per team that's used as a Dirichlet prior on top of
historical evidence.

Note: the Kaggle EA FC 25 export ships with most fine-grained attribute
columns (finishing, positioning, shot_power, etc.) empty. The signal we get
is overall_rating, positions, specialities, international_reputation. Quality
is derived from those:

    quality = position_weight × ((overall − 60) / 39) ** 1.5 × spec_multiplier

where `spec_multiplier` is 1.0 by default and bumped if the player's
`specialities` string mentions a finishing-related tag (Clinical finisher,
Complete forward, Aerial threat, Distance shooter, Power header).
"""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache

import numpy as np
import pandas as pd

from ..config import DATA_RAW
from .matches import TEAM_NAME_MAP
from .squads import _extract_nationality

POSITION_WEIGHT = {
    "ST": 1.00, "CF": 1.00,
    "LW": 0.85, "RW": 0.85,
    "CAM": 0.70,
    "LM": 0.65, "RM": 0.65,
    "CM": 0.30, "CDM": 0.10,
    "LB": 0.10, "RB": 0.10, "LWB": 0.10, "RWB": 0.10,
    "CB": 0.05,
    "GK": 0.0,
}


def _normalize_name(s: str) -> str:
    """ASCII fold + lowercase + collapse whitespace, drop trailing ' -' artifact.

    Also collapses doubled vowels (aa→a, ee→e, ii→i, oo→o, uu→u). This handles
    Norwegian Å↔aa and Dutch oo↔o spelling variants between sources without
    affecting names where the doubled vowel doesn't exist.
    """
    if not isinstance(s, str):
        return ""
    s = re.sub(r"\s*-\s*$", "", s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^A-Za-z0-9 .']", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    s = re.sub(r"([aeiou])\1", r"\1", s)
    return s


def _position_weight(positions: str) -> float:
    if not isinstance(positions, str):
        return 0.0
    return max(
        (POSITION_WEIGHT.get(p.strip(), 0.0) for p in positions.split(",") if p.strip()),
        default=0.0,
    )


FINISHING_SPECIALITIES = (
    "Clinical finisher", "Complete forward", "Distance shooter",
    "Aerial threat", "Power header", "Acrobat",
)


def _spec_multiplier(specialities: str | float) -> float:
    if not isinstance(specialities, str):
        return 1.0
    bonus = 0.0
    for tag in FINISHING_SPECIALITIES:
        if tag in specialities:
            bonus += 0.20 if tag in ("Clinical finisher", "Complete forward") else 0.10
    return min(1.0 + bonus, 1.7)


def _attacking_quality(row: pd.Series) -> float:
    pw = _position_weight(row["positions"])
    if pw <= 0:
        return 0.0
    overall = float(row["overall_rating"])
    base = max(0.0, (overall - 60.0) / 39.0) ** 1.5
    return pw * base * _spec_multiplier(row.get("specialities"))


@lru_cache(maxsize=1)
def player_table(squad_size: int = 26) -> pd.DataFrame:
    """Return per-player table restricted to top-N by overall_rating per team.

    Columns: nation, player_id, name, full_name, name_norm, full_norm,
             positions, overall_rating, attacking_quality.
    """
    df = pd.read_csv(DATA_RAW / "sofifa_players.csv", low_memory=False)
    nation = df["country_name"].where(
        df["country_name"].notna() & (df["country_name"] != "Friendly International")
    )
    df["nation"] = nation.fillna(df["description"].map(_extract_nationality))
    df["nation"] = df["nation"].replace(TEAM_NAME_MAP)
    df = df.dropna(subset=["nation", "overall_rating"])

    df["name"] = df["name"].astype(str).str.replace(r"\s*-\s*$", "", regex=True).str.strip()
    df["full_name"] = df["full_name"].astype(str).str.strip()
    df["name_norm"] = df["name"].map(_normalize_name)
    df["full_norm"] = df["full_name"].map(_normalize_name)
    df["overall_rating"] = df["overall_rating"].astype(float)
    df["attacking_quality"] = df.apply(_attacking_quality, axis=1)

    df = df.sort_values("overall_rating", ascending=False).groupby("nation").head(squad_size)
    return df[
        ["nation", "player_id", "name", "full_name", "name_norm", "full_norm",
         "positions", "overall_rating", "attacking_quality"]
    ].reset_index(drop=True)


def fc25_share(squad_size: int = 26) -> pd.DataFrame:
    """Per-team attacking-quality share (sums to 1 per team).

    Columns: nation, player_id, name, full_name, name_norm, full_norm,
             attacking_quality, fc25_share.
    """
    pt = player_table(squad_size=squad_size)
    team_total = pt.groupby("nation")["attacking_quality"].transform("sum")
    pt = pt.copy()
    pt["fc25_share"] = np.where(team_total > 0, pt["attacking_quality"] / team_total, 0.0)
    return pt


def match_scorer_to_fc25(scorer_norm: str, team_players: pd.DataFrame) -> str | None:
    """Return player_id of best FC 25 match for a normalized scorer name, or None.

    Match strategy (first hit wins):
      1. exact name_norm equality
      2. exact full_norm equality
      3. scorer_norm is the full set of tokens of name_norm (handles
         'Florian Wirtz' → 'Florian Richard Wirtz' by token-subset)
      4. all tokens of scorer_norm appear in full_norm AND first/last token match
    """
    if not scorer_norm:
        return None

    exact = team_players[team_players["name_norm"] == scorer_norm]
    if not exact.empty:
        return str(exact.iloc[0]["player_id"])

    exact_full = team_players[team_players["full_norm"] == scorer_norm]
    if not exact_full.empty:
        return str(exact_full.iloc[0]["player_id"])

    scorer_tokens = scorer_norm.split()
    if not scorer_tokens:
        return None

    for _, p in team_players.iterrows():
        full_tokens = set(p["full_norm"].split())
        if all(t in full_tokens for t in scorer_tokens) and len(scorer_tokens) >= 2:
            return str(p["player_id"])

    for _, p in team_players.iterrows():
        full_tokens = p["full_norm"].split()
        if not full_tokens:
            continue
        if (scorer_tokens[0] == full_tokens[0] or scorer_tokens[-1] == full_tokens[-1]) \
                and all(t in p["full_norm"] for t in scorer_tokens):
            return str(p["player_id"])

    # Fuzzy fallback for spelling variants (Haaland↔Håland, Schurrle↔Schürrle).
    # Require: at least one token shares first letter, AND overall ratio > 0.85
    # against either name_norm or full_norm. Conservative enough to not match
    # different players inside the same 30-person squad.
    best_id, best_ratio = None, 0.85
    for _, p in team_players.iterrows():
        for cand in (p["name_norm"], p["full_norm"]):
            if not cand:
                continue
            cand_tokens = cand.split()
            if not cand_tokens:
                continue
            if not any(s[0] == c[0] for s in scorer_tokens for c in cand_tokens):
                continue
            r = SequenceMatcher(None, scorer_norm, cand).ratio()
            if r > best_ratio:
                best_ratio = r
                best_id = str(p["player_id"])
    return best_id
