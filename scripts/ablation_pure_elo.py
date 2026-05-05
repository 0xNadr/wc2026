"""Refit the production model with squad=None (pure-Elo priors) and run the
sim, so we can compare champion % deltas vs the production 70/30 mix.

Output: output/traces/dixon_coles_pure_elo.nc and output/results_pure_elo.json
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import TOURNAMENT_START, OUTPUT
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.matches import load_matches
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.features import build_training_frame
from wc2026.model.bayesian import fit_model, save_trace, load_trace


def build_universe(min_year: int = 1990) -> list[str]:
    df = load_matches()
    df = df[df["date"].dt.year >= min_year]
    qual = set(QUALIFIED_TEAMS)
    opps = set(df[df["home_team"].isin(qual)]["away_team"]) | set(
        df[df["away_team"].isin(qual)]["home_team"]
    )
    return sorted(qual | opps)


def main(min_year: int = 1990, draws: int = 1500, tune: int = 1500,
         chains: int = 4, cores: int = 4) -> None:
    universe = build_universe(min_year)
    print(f"Universe: {len(universe)} teams")
    df, _ = build_training_frame(universe, ref_date=TOURNAMENT_START, min_year=min_year)
    print(f"Training matches: {len(df):,}")

    elo = {}
    try:
        elo = fetch_elo_ratings()
    except Exception as e:
        print(f"⚠ Elo unavailable ({e}); using neutral priors")

    # Pure-Elo ablation: squad=None → composite prior is just elo z-score
    trace = fit_model(df, universe, elo, squad=None,
                      draws=draws, tune=tune, chains=chains, cores=cores)
    path = save_trace(trace, name="dixon_coles_pure_elo")
    print(f"✓ Trace saved to {path}")


if __name__ == "__main__":
    main()
