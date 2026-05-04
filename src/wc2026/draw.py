"""Tournament draw: assign the 48 qualified teams to 12 groups of 4.

The actual draw is performed by FIFA (held December 2025). When the real draw
is known, populate ACTUAL_DRAW below; otherwise the simulation uses a seeded
random pot draw following FIFA's standard pot rules:
  - Pot 1: 12 highest-ranked teams (hosts always in pot 1)
  - Pots 2-4: next 12 each by ranking
  - Constraint: no two teams from the same confederation in one group
    (UEFA exception: up to two UEFA teams per group permitted).
"""
from __future__ import annotations

import numpy as np

from .data.tournament import GROUPS, QUALIFIED_TEAMS

# Official FIFA draw, held 2025-12-05 at the Kennedy Center, Washington D.C.
# Source: FIFA.com / NBC Sports / Wikipedia "2026 FIFA World Cup".
ACTUAL_DRAW: dict[str, list[str]] | None = {
    "A": ["Mexico",         "South Africa",          "South Korea",  "Czech Republic"],
    "B": ["Canada",         "Bosnia and Herzegovina","Qatar",        "Switzerland"],
    "C": ["Brazil",         "Morocco",               "Haiti",        "Scotland"],
    "D": ["United States",  "Paraguay",              "Australia",    "Turkey"],
    "E": ["Germany",        "Curaçao",               "Ivory Coast",  "Ecuador"],
    "F": ["Netherlands",    "Japan",                 "Sweden",       "Tunisia"],
    "G": ["Belgium",        "Egypt",                 "Iran",         "New Zealand"],
    "H": ["Spain",          "Cape Verde",            "Saudi Arabia", "Uruguay"],
    "I": ["France",         "Senegal",               "Iraq",         "Norway"],
    "J": ["Argentina",      "Algeria",               "Austria",      "Jordan"],
    "K": ["Portugal",       "DR Congo",              "Uzbekistan",   "Colombia"],
    "L": ["England",        "Croatia",               "Ghana",        "Panama"],
}


def _build_pots(rankings: dict[str, float]) -> list[list[str]]:
    """Hosts forced to pot 1; remaining teams sorted by ranking and split by 12."""
    hosts = [t for t, m in QUALIFIED_TEAMS.items() if m.get("host")]
    rest = [t for t in QUALIFIED_TEAMS if t not in hosts]
    rest.sort(key=lambda t: -rankings.get(t, 1500.0))
    pot1 = hosts + rest[: 12 - len(hosts)]
    pot2 = rest[12 - len(hosts): 24 - len(hosts)]
    pot3 = rest[24 - len(hosts): 36 - len(hosts)]
    pot4 = rest[36 - len(hosts):]
    return [pot1, pot2, pot3, pot4]


def _confederation(team: str) -> str:
    return QUALIFIED_TEAMS[team]["confederation"]


def random_draw(rankings: dict[str, float], seed: int = 26) -> dict[str, list[str]]:
    """Draw 48 teams into 12 groups respecting confederation constraints."""
    rng = np.random.default_rng(seed)
    pots = _build_pots(rankings)
    groups: dict[str, list[str]] = {g: [] for g in GROUPS}

    for pot_idx, pot in enumerate(pots):
        teams = pot[:]
        rng.shuffle(teams)
        # Place each team in the first eligible group (≤ 2 UEFA, no other repeats)
        for team in teams:
            placed = False
            for g in GROUPS:
                if len(groups[g]) != pot_idx:
                    continue
                confeds = [_confederation(t) for t in groups[g]]
                conf = _confederation(team)
                if conf == "UEFA" and confeds.count("UEFA") >= 2:
                    continue
                if conf != "UEFA" and conf in confeds:
                    continue
                groups[g].append(team)
                placed = True
                break
            if not placed:
                # Fallback: relax constraint to keep the draw feasible
                for g in GROUPS:
                    if len(groups[g]) == pot_idx:
                        groups[g].append(team)
                        break

    return groups


def get_groups(rankings: dict[str, float], seed: int = 26) -> dict[str, list[str]]:
    return ACTUAL_DRAW if ACTUAL_DRAW is not None else random_draw(rankings, seed=seed)
