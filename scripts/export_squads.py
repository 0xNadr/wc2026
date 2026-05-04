"""Export top-23 squad rosters per qualified WC2026 team to JSON.

Reuses the nationality resolution from `wc2026.data.squads` so the same
roster cohort that drives the squad_strength metric also drives the
visible roster on the website.
"""
import json
import math
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import DATA_RAW, OUTPUT
from wc2026.data.matches import TEAM_NAME_MAP
from wc2026.data.squads import _extract_nationality
from wc2026.data.tournament import QUALIFIED_TEAMS

WC_KICKOFF = date(2026, 6, 11)
SQUAD_LIMIT = 23


def age_on(dob_str: str | float) -> int | None:
    if not isinstance(dob_str, str) or not dob_str:
        return None
    try:
        d = date.fromisoformat(dob_str.split(" ")[0])
    except ValueError:
        return None
    years = WC_KICKOFF.year - d.year - ((WC_KICKOFF.month, WC_KICKOFF.day) < (d.month, d.day))
    return years


def clean_name(s: str) -> str:
    """Sofifa names sometimes end with " -" — strip it."""
    if not isinstance(s, str):
        return ""
    s = s.strip()
    if s.endswith(" -"):
        s = s[:-2].strip()
    return s


def first_position(s: str | float) -> str | None:
    if not isinstance(s, str) or not s:
        return None
    return s.split(",")[0].strip()


def safe_int(v) -> int | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def safe_str(v) -> str | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = str(v).strip()
    return s if s else None


def main() -> None:
    src = DATA_RAW / "sofifa_players.csv"
    df = pd.read_csv(src, low_memory=False)

    # Resolve nationality (same logic as compute_squad_strength)
    nation = df["country_name"].where(
        df["country_name"].notna() & (df["country_name"] != "Friendly International")
    )
    fallback = df["description"].map(_extract_nationality)
    df["nation"] = nation.fillna(fallback)
    df["nation"] = df["nation"].replace(TEAM_NAME_MAP)
    df = df.dropna(subset=["nation", "overall_rating"])
    df["overall_rating"] = df["overall_rating"].astype(float)

    qualified = set(QUALIFIED_TEAMS.keys())
    df = df[df["nation"].isin(qualified)]

    # Top-23 per team by overall rating
    df = df.sort_values("overall_rating", ascending=False).groupby("nation").head(SQUAD_LIMIT)

    squads: dict[str, list[dict]] = {}
    for nation_name, group in df.groupby("nation"):
        players = []
        for _, row in group.iterrows():
            name = clean_name(row.get("name", ""))
            full = clean_name(row.get("full_name", ""))
            players.append(
                {
                    "name": name or full,
                    "full_name": full if full and full != name else None,
                    "position": first_position(row.get("positions")),
                    "overall": safe_int(row.get("overall_rating")),
                    "potential": safe_int(row.get("potential")),
                    "age": age_on(row.get("dob", "")),
                    "height": safe_int(row.get("height_cm")),
                    "club": safe_str(row.get("club_name")),
                    "club_league": safe_str(row.get("club_league_name")),
                    "foot": safe_str(row.get("preferred_foot")),
                    "value": safe_str(row.get("value")),
                    "wage": safe_str(row.get("wage")),
                    "image": safe_str(row.get("image")),
                }
            )
        # Sort: GKs first, then defenders, midfielders, forwards by overall desc
        pos_order = {
            "GK": 0,
            "CB": 1, "LB": 1, "RB": 1, "LWB": 1, "RWB": 1,
            "CDM": 2, "CM": 2, "CAM": 2, "LM": 2, "RM": 2,
            "LW": 3, "RW": 3, "ST": 3, "CF": 3,
        }
        players.sort(key=lambda p: (pos_order.get(p["position"] or "", 4), -(p["overall"] or 0)))
        squads[nation_name] = players

    # Report missing teams
    missing = qualified - set(squads.keys())
    if missing:
        print(f"⚠ No sofifa players found for: {sorted(missing)}", file=sys.stderr)

    out = OUTPUT / "squads.json"
    out.write_text(json.dumps(squads, indent=2, ensure_ascii=False))
    total_players = sum(len(v) for v in squads.values())
    print(f"✓ Wrote {out}  ({len(squads)} teams, {total_players} players)")


if __name__ == "__main__":
    main()
