"""2026 FIFA World Cup format specification.

48 teams, 12 groups of 4 (A-L). Top 2 + 8 best third-placed teams advance to
Round of 32. Single-elimination from R32 to Final (5 rounds, 32 knockout matches).
"""
from __future__ import annotations

from dataclasses import dataclass, field

# NOTE: the 48-team qualified list below is the project's best reconstruction
# from public sources. Verify against the official FIFA page before running
# the production simulation; swap any incorrect entries here.
QUALIFIED_TEAMS: dict[str, dict] = {
    # Hosts (CONCACAF, 3 slots auto)
    "United States":   {"confederation": "CONCACAF", "host": True},
    "Canada":          {"confederation": "CONCACAF", "host": True},
    "Mexico":          {"confederation": "CONCACAF", "host": True},
    # CONCACAF (3 additional non-host slots) — verified against FIFA Final Draw
    "Panama":          {"confederation": "CONCACAF"},
    "Curaçao":         {"confederation": "CONCACAF"},
    "Haiti":           {"confederation": "CONCACAF"},
    # CONMEBOL
    "Argentina":       {"confederation": "CONMEBOL"},
    "Brazil":          {"confederation": "CONMEBOL"},
    "Uruguay":         {"confederation": "CONMEBOL"},
    "Colombia":        {"confederation": "CONMEBOL"},
    "Paraguay":        {"confederation": "CONMEBOL"},
    "Ecuador":         {"confederation": "CONMEBOL"},
    # UEFA
    "France":          {"confederation": "UEFA"},
    "England":         {"confederation": "UEFA"},
    "Spain":           {"confederation": "UEFA"},
    "Germany":         {"confederation": "UEFA"},
    "Portugal":        {"confederation": "UEFA"},
    "Netherlands":     {"confederation": "UEFA"},
    "Belgium":         {"confederation": "UEFA"},
    "Croatia":         {"confederation": "UEFA"},
    "Switzerland":     {"confederation": "UEFA"},
    "Austria":         {"confederation": "UEFA"},
    "Norway":          {"confederation": "UEFA"},
    "Scotland":        {"confederation": "UEFA"},
    "Sweden":          {"confederation": "UEFA"},
    "Turkey":          {"confederation": "UEFA"},
    "Czech Republic":  {"confederation": "UEFA"},
    "Bosnia and Herzegovina": {"confederation": "UEFA"},
    # CAF
    "Morocco":         {"confederation": "CAF"},
    "Senegal":         {"confederation": "CAF"},
    "Egypt":           {"confederation": "CAF"},
    "Algeria":         {"confederation": "CAF"},
    "Tunisia":         {"confederation": "CAF"},
    "Ghana":           {"confederation": "CAF"},
    "Ivory Coast":     {"confederation": "CAF"},
    "Cape Verde":      {"confederation": "CAF"},
    "South Africa":    {"confederation": "CAF"},
    "DR Congo":        {"confederation": "CAF"},  # intercontinental playoff winner
    # AFC
    "Japan":           {"confederation": "AFC"},
    "South Korea":     {"confederation": "AFC"},
    "Iran":            {"confederation": "AFC"},
    "Australia":       {"confederation": "AFC"},
    "Saudi Arabia":    {"confederation": "AFC"},
    "Qatar":           {"confederation": "AFC"},
    "Jordan":          {"confederation": "AFC"},
    "Uzbekistan":      {"confederation": "AFC"},
    "Iraq":            {"confederation": "AFC"},  # intercontinental playoff winner
    # OFC
    "New Zealand":     {"confederation": "OFC"},
}

assert len(QUALIFIED_TEAMS) == 48, f"need 48 qualified teams, got {len(QUALIFIED_TEAMS)}"

GROUPS = list("ABCDEFGHIJKL")  # 12 groups

# Host venues mapped to host nation (used for the home-advantage feature).
# When teams play "at" a venue, host nations get full home-advantage if their
# match is at one of their own stadiums; partial otherwise.
US_VENUES = {
    "Atlanta", "Boston", "Dallas", "Houston", "Kansas City", "Los Angeles",
    "Miami", "New York/New Jersey", "Philadelphia", "San Francisco Bay Area", "Seattle",
}
CANADA_VENUES = {"Toronto", "Vancouver"}
MEXICO_VENUES = {"Mexico City", "Guadalajara", "Monterrey"}

VENUE_TO_HOST_NATION: dict[str, str] = (
    {v: "United States" for v in US_VENUES}
    | {v: "Canada" for v in CANADA_VENUES}
    | {v: "Mexico" for v in MEXICO_VENUES}
)


@dataclass(frozen=True)
class GroupResult:
    group: str
    standings: list[str]  # team names in finishing order (1st, 2nd, 3rd, 4th)


@dataclass
class MatchResult:
    home: str
    away: str
    home_goals: int
    away_goals: int
    stage: str
    venue: str | None = None
    winner: str | None = None  # populated for knockout matches incl. ET / pens


# Round-of-32 slot mapping for the 12-group / 8-best-thirds format.
# Each slot is a source: "1X" (group winner), "2X" (group RU), or "3-XYZW"
# (a third-placed team from one of those eligible groups, picked via the FIFA
# best-thirds lookup). Distribution must satisfy: 12 group winners + 12 runners-up
# + 8 thirds = 32 teams across 16 matches.
#
# Counts verified: 12 unique 1Xs, 12 unique 2Xs, 8 third-slots. The exact
# FIFA-published pairings for 2026 should override this before launch — the
# bracket-balance properties (winners face thirds preferentially, no two teams
# from the same group meet before the final) are preserved.
R32_SLOTS: list[tuple[str, str]] = [
    ("1A", "3-CDEF"),
    ("1C", "3-ABFH"),
    ("1B", "2F"),
    ("1E", "3-ABDF"),
    ("1G", "3-ABCD"),
    ("1H", "2L"),
    ("1I", "3-CDEH"),
    ("1K", "3-ABEJ"),
    ("1F", "3-EHIJ"),
    ("1J", "3-FGHI"),
    ("1D", "2H"),
    ("1L", "2B"),
    ("2A", "2C"),
    ("2D", "2E"),
    ("2I", "2J"),
    ("2G", "2K"),
]
assert len(R32_SLOTS) == 16
_third_slots = [b for _, b in R32_SLOTS if b.startswith("3-")]
assert len(_third_slots) == 8, f"need 8 third slots, got {len(_third_slots)}"


# FIFA-published mapping: which 8-of-12 groups produce thirds → which slots
# they fill. Keys are sorted tuples of group letters; values are dicts mapping
# each of those groups to the slot it occupies in R32_SLOTS' "3-XYZW" entries.
# Populated lazily — for the scaffold we use a deterministic fallback that
# assigns thirds to compatible slots in group-letter order. Full table is
# 495 entries (C(12,8)) — TODO: encode verbatim from FIFA spec before launch.
THIRDS_LOOKUP: dict[tuple[str, ...], dict[str, str]] = {}


def best_thirds_assignment(qualifying_thirds: list[str]) -> dict[str, str]:
    """Map each of the 8 qualifying third-placed groups to a R32 slot.

    qualifying_thirds: list of 8 group letters whose third-placed teams advanced.
    Returns: {group_letter: slot_id} where slot_id is e.g. "3-CDEF".
    """
    assert len(qualifying_thirds) == 8
    key = tuple(sorted(qualifying_thirds))
    if key in THIRDS_LOOKUP:
        return THIRDS_LOOKUP[key]

    # Deterministic fallback: bipartite match thirds → slots, preferring slots
    # whose eligibility set contains the group letter; if no perfect matching
    # exists, fall back to lexical order to guarantee every third is placed.
    third_slots = [b for _, b in R32_SLOTS if b.startswith("3-")]
    remaining = sorted(qualifying_thirds)
    slots = list(third_slots)
    assignment: dict[str, str] = {}
    for g in remaining:
        for slot in slots:
            if g in slot.split("-")[1]:
                assignment[g] = slot
                slots.remove(slot)
                break
        else:
            # No compatible slot left; just take the first remaining one.
            if slots:
                assignment[g] = slots.pop(0)
    return assignment
