"""Export per-team metadata (Elo, squad strength, confederation, group) to JSON."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import OUTPUT
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.squads import compute_squad_strength
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.draw import ACTUAL_DRAW


def main() -> None:
    elo = fetch_elo_ratings()
    squad_df = compute_squad_strength()
    squad_map = squad_df.set_index("nation")[["squad_strength", "squad_top11", "squad_n"]].to_dict("index")

    # Find which group each team is in
    team_to_group = {}
    if ACTUAL_DRAW:
        for letter, teams in ACTUAL_DRAW.items():
            for t in teams:
                team_to_group[t] = letter

    # FIFA-style ranking by Elo (since we don't have actual FIFA ranks)
    elo_rank = {t: i for i, t in enumerate(
        sorted(QUALIFIED_TEAMS.keys(), key=lambda x: -elo.get(x, 1500.0)), start=1)}

    teams = {}
    for team, info in QUALIFIED_TEAMS.items():
        squad = squad_map.get(team, {})
        teams[team] = {
            "confederation": info["confederation"],
            "host": info.get("host", False),
            "group": team_to_group.get(team),
            "elo": elo.get(team),
            "elo_rank": elo_rank[team],
            "squad_strength": squad.get("squad_strength"),
            "squad_top11": squad.get("squad_top11"),
            "squad_n": int(squad["squad_n"]) if "squad_n" in squad else None,
        }

    out = OUTPUT / "team_meta.json"
    out.write_text(json.dumps(teams, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {out}  ({len(teams)} teams)")


if __name__ == "__main__":
    main()
