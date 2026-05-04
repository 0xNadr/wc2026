"""Pre-compute pairwise match probabilities for all 48×48 team combinations.

For each ordered (team_a, team_b) pair, samples from the posterior with both
teams treated as playing on a neutral venue and reports:
  - p_a_win, p_draw, p_b_win
  - expected goals for each team
  - most likely scoreline (mode of the bivariate Poisson)

Output: output/matchups.json — shape:
{
  "teams": [...],
  "matchups": {
    "Argentina|Brazil": {"p_a": 0.41, "p_d": 0.27, "p_b": 0.32, "ea": 1.4, "eb": 1.2, "top_score": [1, 1]},
    ...
  }
}
"""
import json
import sys
from pathlib import Path

import numpy as np
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import OUTPUT
from wc2026.data.tournament import QUALIFIED_TEAMS
from wc2026.model.bayesian import load_trace


def main(n_samples: int = 5000) -> None:
    teams = sorted(QUALIFIED_TEAMS.keys())
    n = len(teams)
    trace = load_trace("dixon_coles")
    post = trace.posterior
    trace_teams = list(post.coords["team"].values)
    trace_team_idx = {t: i for i, t in enumerate(trace_teams)}
    keep = [trace_team_idx[t] for t in teams]
    att_s = post["att"].stack(sample=("chain", "draw")).to_numpy()[keep]
    def_s = post["def"].stack(sample=("chain", "draw")).to_numpy()[keep]
    int_s = post["intercept"].stack(sample=("chain", "draw")).to_numpy()
    rho_s = post["rho"].stack(sample=("chain", "draw")).to_numpy()
    # Note: matchups are at neutral venues, so home_adv is multiplied by 0
    # regardless of model (scalar or per-team). Don't load it here.
    n_post = att_s.shape[1]

    rng = np.random.default_rng(26)
    sample_idx = rng.integers(0, n_post, size=n_samples)

    # Vectorize across draws but loop pairs (n*(n-1)/2 ≈ 1128 pairs).
    # For each draw, compute λ matrix once and sample once.
    matchups: dict[str, dict] = {}
    pairs = [(i, j) for i in range(n) for j in range(n) if i != j]

    for s in tqdm(sample_idx, desc="posterior draws"):
        att = att_s[:, s]
        defe = def_s[:, s]
        intercept = float(int_s[s])
        rho = float(rho_s[s])
        # Neutral venues — no home advantage
        log_lam = intercept + att[:, None] - defe[None, :]
        lam = np.exp(np.clip(log_lam, -3.0, 3.0))
        # For each pair, sample one (gh, ga) from independent Poisson + accept τ
        for i, j in pairs:
            key = f"{teams[i]}|{teams[j]}"
            entry = matchups.setdefault(
                key, {"a_win": 0, "draw": 0, "b_win": 0, "g_a": 0, "g_b": 0,
                      "score_counts": {}}
            )
            ga = int(rng.poisson(lam[i, j]))
            gb = int(rng.poisson(lam[j, i]))
            # τ rejection (low-score correction, only meaningful for ≤1 cells)
            if (ga + gb) <= 2:
                tau = 1.0
                if ga == 0 and gb == 0:
                    tau = 1 - lam[i, j] * rho
                elif ga == 0 and gb == 1:
                    tau = 1 + lam[i, j] * rho
                elif ga == 1 and gb == 0:
                    tau = 1 + lam[j, i] * rho
                elif ga == 1 and gb == 1:
                    tau = 1 - rho
                if tau < 1.0 and rng.uniform() > tau:
                    continue
            if ga > gb:
                entry["a_win"] += 1
            elif ga < gb:
                entry["b_win"] += 1
            else:
                entry["draw"] += 1
            entry["g_a"] += ga
            entry["g_b"] += gb
            score_key = f"{ga}-{gb}"
            entry["score_counts"][score_key] = entry["score_counts"].get(score_key, 0) + 1

    out_matchups = {}
    for key, e in matchups.items():
        total = e["a_win"] + e["draw"] + e["b_win"]
        if total == 0:
            continue
        top_score = max(e["score_counts"].items(), key=lambda kv: kv[1])[0]
        out_matchups[key] = {
            "p_a": e["a_win"] / total,
            "p_d": e["draw"] / total,
            "p_b": e["b_win"] / total,
            "ea": e["g_a"] / total,
            "eb": e["g_b"] / total,
            "top_score": top_score,
        }

    payload = {"teams": teams, "matchups": out_matchups, "n_samples": int(n_samples)}
    out = OUTPUT / "matchups.json"
    out.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"✓ Wrote {out}  ({len(out_matchups):,} pairs)")


if __name__ == "__main__":
    main()
