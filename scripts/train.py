"""Fit the Bayesian Dixon-Coles model on the 1-hop training universe.

The training universe = the 48 qualified teams + every team that has played
against a qualified team since `min_year`. Including these "neighbour"
opponents ~7×s the training data and informs the qualified teams' strength
through transitive opponents (e.g. France beating Albania tells us about
France even though Albania isn't at the WC).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import TOURNAMENT_START
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.matches import load_matches
from wc2026.data.squads import compute_squad_strength
from wc2026.data.squads_tm import compute_squad_strength_tm
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.features import build_training_frame
from wc2026.model.bayesian import fit_model, save_trace

SQUAD_SOURCES = {"ea": compute_squad_strength, "tm": compute_squad_strength_tm}


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
         chains: int = 4, cores: int = 4, squad_source: str = "ea") -> None:
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
        squad = SQUAD_SOURCES[squad_source]()
        print(f"✓ Squad source: {squad_source} ({len(squad)} nations)")
    except Exception as e:
        print(f"⚠ Squad data unavailable ({e}); using Elo-only priors")
        squad = None

    trace = fit_model(df, universe, elo, squad,
                      draws=draws, tune=tune, chains=chains, cores=cores)
    path = save_trace(trace, name=f"dixon_coles_{squad_source}")
    print(f"✓ Trace saved to {path}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--squad-source", choices=list(SQUAD_SOURCES), default="ea",
                   help="ea = EA FC 25 ratings (default), tm = Transfermarkt market values")
    p.add_argument("--min-year", type=int, default=1990)
    p.add_argument("--draws", type=int, default=2000)
    p.add_argument("--tune", type=int, default=2000)
    p.add_argument("--chains", type=int, default=4)
    p.add_argument("--cores", type=int, default=4)
    args = p.parse_args()
    main(min_year=args.min_year, draws=args.draws, tune=args.tune,
         chains=args.chains, cores=args.cores, squad_source=args.squad_source)
