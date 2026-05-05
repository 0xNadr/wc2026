"""Monte Carlo simulation of WC2026 using the fitted posterior.

Each simulated tournament uses a fresh draw from the posterior (parameter
uncertainty) AND a fresh sequence of match outcomes (aleatoric uncertainty).
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

    trace = load_trace("dixon_coles")
    post = trace.posterior
    # The trace may have been fitted on a wider universe (1-hop neighbours of
    # the 48 qualified teams). Slice the att/def arrays so position i matches
    # the i-th qualified team, not the i-th team in the trace's coord order.
    trace_teams = list(post.coords["team"].values)
    trace_team_idx = {t: i for i, t in enumerate(trace_teams)}
    missing = [t for t in teams if t not in trace_team_idx]
    if missing:
        raise RuntimeError(f"qualified teams missing from trace: {missing}")
    keep = [trace_team_idx[t] for t in teams]
    att_samples = post["att"].stack(sample=("chain", "draw")).to_numpy()[keep]
    def_samples = post["def"].stack(sample=("chain", "draw")).to_numpy()[keep]
    intercept_samples = post["intercept"].stack(sample=("chain", "draw")).to_numpy()
    # home_adv may be either scalar (legacy single-γ model) or per-team array
    # (new hierarchical model). We always pass a per-team-aligned array forward.
    ha_raw = post["home_adv"].stack(sample=("chain", "draw")).to_numpy()
    if ha_raw.ndim == 1:
        # Legacy scalar — broadcast to per-team
        home_adv_samples = np.broadcast_to(ha_raw[None, :], (len(teams), ha_raw.shape[0]))
    else:
        home_adv_samples = ha_raw[keep]
    rho_samples = post["rho"].stack(sample=("chain", "draw")).to_numpy()
    n_post = att_samples.shape[1]

    # Tournament-context offsets (Ley et al. 2019). Pre-2026 traces won't have
    # this variable — fall back to 0 in that case so simulate.py stays
    # backward-compatible with older saved traces.
    if "alpha_match_type" in post.data_vars:
        from wc2026.features import MATCH_TYPE_IDX
        amt = post["alpha_match_type"].stack(sample=("chain", "draw")).to_numpy()
        wc_group_offsets = amt[MATCH_TYPE_IDX["wc_group"]]
        wc_knockout_offsets = amt[MATCH_TYPE_IDX["wc_knockout"]]
    else:
        wc_group_offsets = np.zeros(n_post)
        wc_knockout_offsets = np.zeros(n_post)

    rng = np.random.default_rng(RANDOM_SEED)
    results = []
    for _ in tqdm(range(n_sims), desc="simulating tournaments"):
        s = rng.integers(0, n_post)
        att = att_samples[:, s]
        defe = def_samples[:, s]
        intercept = float(intercept_samples[s])
        home_adv = home_adv_samples[:, s]  # per-team array
        rho = float(rho_samples[s])
        result = simulate_tournament(
            groups_by_idx, att, defe, intercept, home_adv, rho, fifa_rank, rng,
            wc_group_offset=float(wc_group_offsets[s]),
            wc_knockout_offset=float(wc_knockout_offsets[s]),
        )
        results.append(result)

    payload = aggregate(results, teams)
    payload["groups"] = groups_by_letter
    payload["alternate_realities"] = sample_alternate_realities(results, teams, k=100)
    out = write_results(payload)
    print(f"✓ Wrote {out} ({n_sims:,} simulations)")
    top10 = sorted(payload["probabilities"]["champion"].items(), key=lambda x: -x[1])[:10]
    print("Top 10 champion probabilities:")
    for t, p in top10:
        print(f"  {t:30s} {p*100:5.2f}%")


if __name__ == "__main__":
    main()
