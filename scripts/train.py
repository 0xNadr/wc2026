"""Fit the Bayesian Dixon-Coles model on the 1-hop training universe.

The training universe = the 48 qualified teams + every team that has played
against a qualified team since `min_year`. Including these "neighbour"
opponents ~7×s the training data and informs the qualified teams' strength
through transitive opponents (e.g. France beating Albania tells us about
France even though Albania isn't at the WC).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import TOURNAMENT_START
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.matches import load_matches
from wc2026.data.squads import compute_squad_strength
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.features import build_training_frame
from wc2026.model.bayesian import fit_model, save_trace


def build_universe(min_year: int) -> list[str]:
    """1-hop neighbourhood: qualified teams + everyone who's played one of them."""
    df = load_matches()
    df = df[df["date"].dt.year >= min_year]
    qual = set(QUALIFIED_TEAMS)
    opps = set(df[df["home_team"].isin(qual)]["away_team"]) | set(
        df[df["away_team"].isin(qual)]["home_team"]
    )
    return sorted(qual | opps)


def main(min_year: int = 1990, draws: int = 2000, tune: int = 2000,
         chains: int = 4, cores: int = 4) -> None:
    universe = build_universe(min_year)
    print(f"Universe: {len(universe)} teams (48 qualified + "
          f"{len(universe) - len(QUALIFIED_TEAMS)} neighbours)")

    df, team_to_idx = build_training_frame(universe, ref_date=TOURNAMENT_START, min_year=min_year)
    print(f"Training matches: {len(df):,}")

    elo: dict[str, float] = {}
    try:
        elo = fetch_elo_ratings()
    except Exception as e:
        print(f"⚠ Elo unavailable ({e}); using neutral priors")

    try:
        squad = compute_squad_strength()
    except Exception as e:
        print(f"⚠ Squad data unavailable ({e}); using Elo-only priors")
        squad = None

    trace = fit_model(df, universe, elo, squad,
                      draws=draws, tune=tune, chains=chains, cores=cores)
    path = save_trace(trace, name="dixon_coles")
    print(f"✓ Trace saved to {path}")


if __name__ == "__main__":
    main()
