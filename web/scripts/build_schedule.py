"""Build public/schedule.json from the WC2026 fixture list.

Source: FIFA confirmed fixture list (mirrored at fwcmania.com/schedule/).
Each match's local kickoff is converted to a UTC ISO string using the
venue's IANA timezone. Mexico City / Guadalajara / Monterrey are UTC-6
year-round (Mexico abolished DST in 2022).
"""

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

VENUE_TZ = {
    "Mexico City Stadium": "America/Mexico_City",
    "Guadalajara Stadium": "America/Mexico_City",
    "Monterrey Stadium": "America/Mexico_City",
    "Toronto Stadium": "America/Toronto",
    "BC Place Vancouver": "America/Vancouver",
    "New York/New Jersey Stadium": "America/New_York",
    "Boston Stadium": "America/New_York",
    "Philadelphia Stadium": "America/New_York",
    "Miami Stadium": "America/New_York",
    "Atlanta Stadium": "America/New_York",
    "Los Angeles Stadium": "America/Los_Angeles",
    "Seattle Stadium": "America/Los_Angeles",
    "San Francisco Bay Area Stadium": "America/Los_Angeles",
    "Houston Stadium": "America/Chicago",
    "Dallas Stadium": "America/Chicago",
    "Kansas City Stadium": "America/Chicago",
}

VENUE_CITY = {
    "Mexico City Stadium": "Mexico City, MEX",
    "Guadalajara Stadium": "Guadalajara, MEX",
    "Monterrey Stadium": "Monterrey, MEX",
    "Toronto Stadium": "Toronto, CAN",
    "BC Place Vancouver": "Vancouver, CAN",
    "New York/New Jersey Stadium": "New York/NJ, USA",
    "Boston Stadium": "Boston, USA",
    "Philadelphia Stadium": "Philadelphia, USA",
    "Miami Stadium": "Miami, USA",
    "Atlanta Stadium": "Atlanta, USA",
    "Los Angeles Stadium": "Los Angeles, USA",
    "Seattle Stadium": "Seattle, USA",
    "San Francisco Bay Area Stadium": "San Francisco Bay, USA",
    "Houston Stadium": "Houston, USA",
    "Dallas Stadium": "Dallas, USA",
    "Kansas City Stadium": "Kansas City, USA",
}

# Group lookup is built from results.json so we don't duplicate truth.

# Each row: (match_no, "YYYY-MM-DD HH:MM" local, venue, stage, home, away)
ROWS = [
    (1, "2026-06-11 13:00", "Mexico City Stadium", "Group A", "Mexico", "South Africa"),
    (2, "2026-06-11 20:00", "Guadalajara Stadium", "Group A", "South Korea", "Czech Republic"),
    (3, "2026-06-12 15:00", "Toronto Stadium", "Group B", "Canada", "Bosnia and Herzegovina"),
    (4, "2026-06-12 18:00", "Los Angeles Stadium", "Group D", "United States", "Paraguay"),
    (5, "2026-06-13 12:00", "San Francisco Bay Area Stadium", "Group B", "Qatar", "Switzerland"),
    (6, "2026-06-13 18:00", "New York/New Jersey Stadium", "Group C", "Brazil", "Morocco"),
    (7, "2026-06-13 21:00", "Boston Stadium", "Group C", "Haiti", "Scotland"),
    (8, "2026-06-13 21:00", "BC Place Vancouver", "Group D", "Australia", "Turkey"),
    (9, "2026-06-14 12:00", "Houston Stadium", "Group E", "Germany", "Curaçao"),
    (10, "2026-06-14 15:00", "Dallas Stadium", "Group F", "Netherlands", "Japan"),
    (11, "2026-06-14 19:00", "Philadelphia Stadium", "Group E", "Ivory Coast", "Ecuador"),
    (12, "2026-06-14 20:00", "Monterrey Stadium", "Group F", "Sweden", "Tunisia"),
    (13, "2026-06-15 12:00", "Atlanta Stadium", "Group H", "Spain", "Cape Verde"),
    (14, "2026-06-15 12:00", "Seattle Stadium", "Group G", "Belgium", "Egypt"),
    (15, "2026-06-15 18:00", "Miami Stadium", "Group H", "Saudi Arabia", "Uruguay"),
    (16, "2026-06-15 18:00", "Los Angeles Stadium", "Group G", "Iran", "New Zealand"),
    (17, "2026-06-16 15:00", "New York/New Jersey Stadium", "Group I", "France", "Senegal"),
    (18, "2026-06-16 18:00", "Boston Stadium", "Group I", "Iraq", "Norway"),
    (19, "2026-06-16 20:00", "Kansas City Stadium", "Group J", "Argentina", "Algeria"),
    (20, "2026-06-16 21:00", "San Francisco Bay Area Stadium", "Group J", "Austria", "Jordan"),
    (21, "2026-06-17 12:00", "Houston Stadium", "Group K", "Portugal", "DR Congo"),
    (22, "2026-06-17 15:00", "Dallas Stadium", "Group L", "England", "Croatia"),
    (23, "2026-06-17 19:00", "Toronto Stadium", "Group L", "Ghana", "Panama"),
    (24, "2026-06-17 20:00", "Mexico City Stadium", "Group K", "Uzbekistan", "Colombia"),
    (25, "2026-06-18 12:00", "Atlanta Stadium", "Group A", "Czech Republic", "South Africa"),
    (26, "2026-06-18 12:00", "Los Angeles Stadium", "Group B", "Switzerland", "Bosnia and Herzegovina"),
    (27, "2026-06-18 15:00", "BC Place Vancouver", "Group B", "Canada", "Qatar"),
    (28, "2026-06-18 19:00", "Guadalajara Stadium", "Group A", "Mexico", "South Korea"),
    (29, "2026-06-19 12:00", "Seattle Stadium", "Group D", "United States", "Australia"),
    (30, "2026-06-19 18:00", "Boston Stadium", "Group C", "Scotland", "Morocco"),
    (31, "2026-06-19 20:00", "San Francisco Bay Area Stadium", "Group D", "Turkey", "Paraguay"),
    (32, "2026-06-19 20:30", "Philadelphia Stadium", "Group C", "Brazil", "Haiti"),
    (33, "2026-06-20 12:00", "Houston Stadium", "Group F", "Netherlands", "Sweden"),
    (34, "2026-06-20 16:00", "Toronto Stadium", "Group E", "Germany", "Ivory Coast"),
    (35, "2026-06-20 19:00", "Kansas City Stadium", "Group E", "Ecuador", "Curaçao"),
    (36, "2026-06-20 22:00", "Monterrey Stadium", "Group F", "Tunisia", "Japan"),
    (37, "2026-06-21 12:00", "Atlanta Stadium", "Group H", "Spain", "Saudi Arabia"),
    (38, "2026-06-21 12:00", "Los Angeles Stadium", "Group G", "Belgium", "Iran"),
    (39, "2026-06-21 18:00", "Miami Stadium", "Group H", "Uruguay", "Cape Verde"),
    (40, "2026-06-21 18:00", "BC Place Vancouver", "Group G", "New Zealand", "Egypt"),
    (41, "2026-06-22 12:00", "Dallas Stadium", "Group J", "Argentina", "Austria"),
    (42, "2026-06-22 17:00", "Philadelphia Stadium", "Group I", "France", "Iraq"),
    (43, "2026-06-22 20:00", "New York/New Jersey Stadium", "Group I", "Norway", "Senegal"),
    (44, "2026-06-22 20:00", "San Francisco Bay Area Stadium", "Group J", "Jordan", "Algeria"),
    (45, "2026-06-23 12:00", "Houston Stadium", "Group K", "Portugal", "Uzbekistan"),
    (46, "2026-06-23 16:00", "Boston Stadium", "Group L", "England", "Ghana"),
    (47, "2026-06-23 19:00", "Toronto Stadium", "Group L", "Panama", "Croatia"),
    (48, "2026-06-23 20:00", "Guadalajara Stadium", "Group K", "Colombia", "DR Congo"),
    (49, "2026-06-24 12:00", "BC Place Vancouver", "Group B", "Switzerland", "Canada"),
    (50, "2026-06-24 12:00", "Seattle Stadium", "Group B", "Bosnia and Herzegovina", "Qatar"),
    (51, "2026-06-24 18:00", "Miami Stadium", "Group C", "Scotland", "Brazil"),
    (52, "2026-06-24 18:00", "Atlanta Stadium", "Group C", "Morocco", "Haiti"),
    (53, "2026-06-24 19:00", "Mexico City Stadium", "Group A", "Czech Republic", "Mexico"),
    (54, "2026-06-24 19:00", "Monterrey Stadium", "Group A", "South Africa", "South Korea"),
    (55, "2026-06-25 16:00", "Philadelphia Stadium", "Group E", "Curaçao", "Ivory Coast"),
    (56, "2026-06-25 16:00", "New York/New Jersey Stadium", "Group E", "Ecuador", "Germany"),
    (57, "2026-06-25 18:00", "Dallas Stadium", "Group F", "Japan", "Sweden"),
    (58, "2026-06-25 18:00", "Kansas City Stadium", "Group F", "Tunisia", "Netherlands"),
    (59, "2026-06-25 19:00", "Los Angeles Stadium", "Group D", "Turkey", "United States"),
    (60, "2026-06-25 19:00", "San Francisco Bay Area Stadium", "Group D", "Paraguay", "Australia"),
    (61, "2026-06-26 15:00", "Boston Stadium", "Group I", "Norway", "France"),
    (62, "2026-06-26 15:00", "Toronto Stadium", "Group I", "Senegal", "Iraq"),
    (63, "2026-06-26 19:00", "Guadalajara Stadium", "Group H", "Uruguay", "Spain"),
    (64, "2026-06-26 19:00", "Houston Stadium", "Group H", "Cape Verde", "Saudi Arabia"),
    (65, "2026-06-26 20:00", "Seattle Stadium", "Group G", "Egypt", "Iran"),
    (66, "2026-06-26 20:00", "BC Place Vancouver", "Group G", "New Zealand", "Belgium"),
    (67, "2026-06-27 17:00", "New York/New Jersey Stadium", "Group L", "Panama", "England"),
    (68, "2026-06-27 17:00", "Philadelphia Stadium", "Group L", "Croatia", "Ghana"),
    (69, "2026-06-27 19:30", "Miami Stadium", "Group K", "Colombia", "Portugal"),
    (70, "2026-06-27 19:30", "Atlanta Stadium", "Group K", "DR Congo", "Uzbekistan"),
    (71, "2026-06-27 21:00", "Kansas City Stadium", "Group J", "Algeria", "Austria"),
    (72, "2026-06-27 21:00", "Dallas Stadium", "Group J", "Jordan", "Argentina"),
    (73, "2026-06-28 12:00", "Los Angeles Stadium", "Round of 32", "Winner A", "Runner-up B"),
    (74, "2026-06-29 16:30", "Boston Stadium", "Round of 32", "Winner E", "3rd A/B/C/D/F"),
    (75, "2026-06-29 19:00", "Monterrey Stadium", "Round of 32", "Winner F", "Runner-up C"),
    (76, "2026-06-29 12:00", "Houston Stadium", "Round of 32", "Winner C", "Runner-up F"),
    (77, "2026-06-30 12:00", "Dallas Stadium", "Round of 32", "Runner-up E", "Runner-up I"),
    (78, "2026-06-30 17:00", "New York/New Jersey Stadium", "Round of 32", "Winner I", "3rd C/D/F/G/H"),
    (79, "2026-06-30 19:00", "Mexico City Stadium", "Round of 32", "Winner A", "3rd C/E/F/H/I"),
    (80, "2026-07-01 12:00", "Atlanta Stadium", "Round of 32", "Winner L", "3rd E/H/I/J/K"),
    (81, "2026-07-01 13:00", "Seattle Stadium", "Round of 32", "Winner G", "3rd A/E/H/I/J"),
    (82, "2026-07-01 17:00", "San Francisco Bay Area Stadium", "Round of 32", "Winner D", "3rd B/E/F/I/J"),
    (83, "2026-07-02 12:00", "Los Angeles Stadium", "Round of 32", "Winner H", "Runner-up J"),
    (84, "2026-07-02 19:00", "Toronto Stadium", "Round of 32", "Runner-up K", "Runner-up L"),
    (85, "2026-07-02 20:00", "BC Place Vancouver", "Round of 32", "Winner B", "3rd E/F/G/I/J"),
    (86, "2026-07-03 13:00", "Dallas Stadium", "Round of 32", "Runner-up D", "Runner-up G"),
    (87, "2026-07-03 18:00", "Miami Stadium", "Round of 32", "Winner J", "Runner-up H"),
    (88, "2026-07-03 20:30", "Kansas City Stadium", "Round of 32", "Winner K", "3rd D/E/I/J/L"),
    (89, "2026-07-04 12:00", "Houston Stadium", "Round of 16", "Winner 73", "Winner 75"),
    (90, "2026-07-04 17:00", "Philadelphia Stadium", "Round of 16", "Winner 74", "Winner 77"),
    (91, "2026-07-05 16:00", "New York/New Jersey Stadium", "Round of 16", "Winner 76", "Winner 78"),
    (92, "2026-07-05 18:00", "Mexico City Stadium", "Round of 16", "Winner 79", "Winner 80"),
    (93, "2026-07-06 14:00", "Dallas Stadium", "Round of 16", "Winner 83", "Winner 84"),
    (94, "2026-07-06 17:00", "Seattle Stadium", "Round of 16", "Winner 81", "Winner 82"),
    (95, "2026-07-07 12:00", "Atlanta Stadium", "Round of 16", "Winner 86", "Winner 88"),
    (96, "2026-07-07 13:00", "BC Place Vancouver", "Round of 16", "Winner 85", "Winner 87"),
    (97, "2026-07-09 16:00", "Boston Stadium", "Quarter-final", "Winner 89", "Winner 90"),
    (98, "2026-07-10 12:00", "Los Angeles Stadium", "Quarter-final", "Winner 93", "Winner 94"),
    (99, "2026-07-11 17:00", "Miami Stadium", "Quarter-final", "Winner 91", "Winner 92"),
    (100, "2026-07-11 20:00", "Kansas City Stadium", "Quarter-final", "Winner 95", "Winner 96"),
    (101, "2026-07-14 14:00", "Dallas Stadium", "Semi-final", "Winner 97", "Winner 98"),
    (102, "2026-07-15 15:00", "Atlanta Stadium", "Semi-final", "Winner 99", "Winner 100"),
    (103, "2026-07-18 17:00", "Miami Stadium", "Third place", "Loser 101", "Loser 102"),
    (104, "2026-07-19 15:00", "New York/New Jersey Stadium", "Final", "Winner 101", "Winner 102"),
]


def main() -> None:
    here = Path(__file__).resolve().parent
    web = here.parent
    results = json.loads((web / "public" / "results.json").read_text())
    team_to_group = {t: letter for letter, teams in results["groups"].items() for t in teams}

    matches = []
    for num, local_str, venue, stage, home, away in ROWS:
        tz = VENUE_TZ[venue]
        local = datetime.strptime(local_str, "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo(tz))
        kickoff_utc = local.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
        # Group: derive from stage if "Group X", else map by team
        if stage.startswith("Group "):
            group = stage.split(" ", 1)[1]
        else:
            group = None
        matches.append({
            "match": num,
            "stage": stage,
            "group": group,
            "venue": venue,
            "city": VENUE_CITY[venue],
            "venueTz": tz,
            "kickoffUtc": kickoff_utc,
            "home": home,
            "away": away,
            "homeGroup": team_to_group.get(home),
            "awayGroup": team_to_group.get(away),
        })

    out = {
        "generatedAt": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "matches": matches,
    }
    out_path = web / "public" / "schedule.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"wrote {out_path} ({len(matches)} matches)")


if __name__ == "__main__":
    main()
