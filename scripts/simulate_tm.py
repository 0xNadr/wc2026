"""Run the simulator on the Transfermarkt-prior trace.

Mirrors scripts/simulate.py but loads `dixon_coles_tm` and writes to
output/results_tm.json so we can compare champion deltas vs production.
"""
import sys
from pathlib import Path

import numpy as np
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.aggregate import aggregate, sample_alternate_realities, write_results
from wc2026.config import N_SIMULATIONS, RANDOM_SEED
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.draw import get_groups
from wc2026.model.bayesian import load_trace
from wc2026.simulate.tournament import simulate_tournament


def main(n_sims: int = N_SIMULATIONS) -> None:
    teams = sorted(QUALIFIED_TEAMS.keys())
    team_to_idx = {t: i for i, t in enumerate(teams)}

    elo = {}
    try:
        elo = fetch_elo_ratings()
    except Exception:
        pass
    rankings = elo if elo else {t: 1500.0 for t in teams}
    groups_by_letter = get_groups(rankings)
    groups_by_idx = {
        g: [team_to_idx[t] for t in members] for g, members in groups_by_letter.items()
    }
    fifa_rank = {team_to_idx[t]: rank for rank, t in
                 enumerate(sorted(teams, key=lambda x: -rankings.get(x, 1500.0)), start=1)}

    trace = load_trace("dixon_coles_tm")
    post = trace.posterior
    trace_teams = list(post.coords["team"].values)
    trace_team_idx = {t: i for i, t in enumerate(trace_teams)}
    keep = [trace_team_idx[t] for t in teams]
    att_samples = post["att"].stack(sample=("chain", "draw")).to_numpy()[keep]
    def_samples = post["def"].stack(sample=("chain", "draw")).to_numpy()[keep]
    intercept_samples = post["intercept"].stack(sample=("chain", "draw")).to_numpy()
    ha_raw = post["home_adv"].stack(sample=("chain", "draw")).to_numpy()
    if ha_raw.ndim == 1:
        n_post = ha_raw.shape[0]
        home_adv_samples = np.broadcast_to(ha_raw, (len(teams), n_post)).copy()
    else:
        home_adv_samples = ha_raw[keep]
    rho_samples = post["rho"].stack(sample=("chain", "draw")).to_numpy()

    if "alpha_match_type" in post.data_vars:
        amt = post["alpha_match_type"].stack(sample=("chain", "draw")).to_numpy()
        match_type_coord = list(post.coords.get("match_type", []))
        if "FIFA World Cup" in match_type_coord:
            wc_idx = match_type_coord.index("FIFA World Cup")
            wc_offset_full = amt[wc_idx]
        else:
            wc_offset_full = np.zeros(amt.shape[1])
    else:
        wc_offset_full = np.zeros(intercept_samples.shape[0])

    n_post = intercept_samples.shape[0]
    rng = np.random.default_rng(RANDOM_SEED)

    results = []
    for _ in tqdm(range(n_sims), desc="simulating tournaments"):
        s = rng.integers(0, n_post)
        att = att_samples[:, s]
        defe = def_samples[:, s]
        intercept = float(intercept_samples[s])
        home_adv = home_adv_samples[:, s]
        rho = float(rho_samples[s])
        result = simulate_tournament(
            groups_by_idx, att, defe, intercept, home_adv, rho, fifa_rank, rng,
            wc_group_offset=float(wc_offset_full[s]),
            wc_knockout_offset=float(wc_offset_full[s]),
        )
        results.append(result)

    payload = aggregate(results, teams)
    payload["groups"] = groups_by_letter
    payload["alternate_realities"] = sample_alternate_realities(results, teams, k=100)
    out = write_results(payload, filename="results_tm.json")
    print(f"✓ Wrote {out} ({n_sims:,} simulations)")
    top10 = sorted(payload["probabilities"]["champion"].items(), key=lambda x: -x[1])[:10]
    print("Top 10 champion probabilities (Transfermarkt prior):")
    for t, p in top10:
        print(f"  {t:30s} {p*100:5.2f}%")


if __name__ == "__main__":
    main()
