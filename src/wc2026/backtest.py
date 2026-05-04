"""Back-test the Bayesian Dixon-Coles model on past World Cups.

For each of 2018 and 2022:
  1. Train universe = all teams that played in the WC (32 teams)
  2. Filter matches to date < tournament_start, including all friendlies/qualifiers
     that informed those 32 teams' strength
  3. Fit the model with no external priors (Elo/squad would leak future info)
  4. For each of the 64 WC matches, compute P(home), P(draw), P(away) by
     sampling 5,000 score pairs from the posterior predictive
  5. Score against actual outcomes with Brier and log-loss

Brier ≤ 0.20 is considered well-calibrated for international football. Log-loss
≤ 1.05 (vs ~1.10 for the naive 1/3-1/3-1/3 baseline) is the practical bar.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd

from .data.matches import load_matches
from .features import build_training_frame
from .model.bayesian import fit_model, posterior_means

WC_DATES = {
    2018: (date(2018, 6, 14), date(2018, 7, 15)),
    2022: (date(2022, 11, 20), date(2022, 12, 18)),
}


@dataclass
class BackTestResult:
    year: int
    n_matches: int
    brier: float
    log_loss: float
    accuracy: float
    score_mae: float                       # mean absolute error on goal totals
    per_match: pd.DataFrame                # per-match predictions + outcomes


def extract_wc_matches(year: int) -> tuple[pd.DataFrame, list[str]]:
    """Return (wc_match_df, teams_in_tournament)."""
    df = load_matches()
    start, end = WC_DATES[year]
    mask = (df["date"] >= pd.Timestamp(start)) & (df["date"] <= pd.Timestamp(end)) & \
           (df["tournament"] == "FIFA World Cup")
    wc = df[mask].copy().reset_index(drop=True)
    teams = sorted(set(wc["home_team"]).union(wc["away_team"]))
    return wc, teams


def predict_match_probs(
    home_idx: int,
    away_idx: int,
    att_samples: np.ndarray,    # (team, sample)
    def_samples: np.ndarray,
    intercept_samples: np.ndarray,
    home_adv_samples: np.ndarray,
    rho_samples: np.ndarray,
    is_neutral: bool,
    n_post_samples: int = 200,
    n_score_samples: int = 50,
    rng: np.random.Generator | None = None,
) -> tuple[float, float, float, float]:
    """Return (P(home win), P(draw), P(away win), expected total goals).

    Marginalizes over n_post_samples posterior draws × n_score_samples per draw.
    """
    rng = rng or np.random.default_rng(26)
    n_total = n_post_samples * n_score_samples
    sample_idx = rng.integers(0, att_samples.shape[1], size=n_post_samples)

    # home_adv may be 1D (legacy global γ) or 2D (per-team γ_i, shape n_teams×n_post)
    home_adv_per_team = home_adv_samples.ndim == 2

    home_wins = draws = away_wins = 0
    total_goals = 0.0
    for s in sample_idx:
        att = att_samples[:, s]
        defe = def_samples[:, s]
        intercept = intercept_samples[s]
        home_adv = home_adv_samples[home_idx, s] if home_adv_per_team else home_adv_samples[s]
        rho = rho_samples[s]
        log_lh = intercept + att[home_idx] - defe[away_idx] + home_adv * (0 if is_neutral else 1)
        log_la = intercept + att[away_idx] - defe[home_idx]
        lam_h = np.exp(log_lh)
        lam_a = np.exp(log_la)
        gh = rng.poisson(lam_h, size=n_score_samples)
        ga = rng.poisson(lam_a, size=n_score_samples)
        home_wins += int(np.sum(gh > ga))
        draws += int(np.sum(gh == ga))
        away_wins += int(np.sum(gh < ga))
        total_goals += float((gh + ga).sum())

    p_home = home_wins / n_total
    p_draw = draws / n_total
    p_away = away_wins / n_total
    expected_goals = total_goals / n_total
    return p_home, p_draw, p_away, expected_goals


def score_match(p_home: float, p_draw: float, p_away: float,
                home_goals: int, away_goals: int) -> tuple[float, float, int]:
    """Return (brier, neg_log_likelihood, predicted_correct)."""
    if home_goals > away_goals:
        actual = (1, 0, 0); winner_p = p_home
    elif home_goals < away_goals:
        actual = (0, 0, 1); winner_p = p_away
    else:
        actual = (0, 1, 0); winner_p = p_draw

    brier = (p_home - actual[0])**2 + (p_draw - actual[1])**2 + (p_away - actual[2])**2
    log_loss = -np.log(max(winner_p, 1e-9))
    pred_outcome = np.argmax([p_home, p_draw, p_away])
    actual_outcome = np.argmax(actual)
    return brier, log_loss, int(pred_outcome == actual_outcome)


def back_test_year(year: int, draws: int = 1000, tune: int = 1000, chains: int = 2,
                   min_year: int = 2000,
                   half_life_years: float | None = None) -> BackTestResult:
    wc_matches, teams = extract_wc_matches(year)
    cutoff_date = WC_DATES[year][0]

    # Build training frame: matches BEFORE the WC starts, restricted to the
    # universe that includes WC participants AND their training opponents.
    df_all = load_matches()
    df_train = df_all[df_all["date"] < pd.Timestamp(cutoff_date)].copy()
    # Include opponents of WC teams to give the hierarchy more data
    universe = set(teams)
    for _ in range(2):  # two-hop neighbourhood
        opps = set(df_train[df_train["home_team"].isin(universe)]["away_team"])
        opps |= set(df_train[df_train["away_team"].isin(universe)]["home_team"])
        universe |= opps
    universe = sorted(universe)
    print(f"  [{year}] training universe: {len(universe)} teams")

    df_feat, team_to_idx = build_training_frame(universe, ref_date=cutoff_date,
                                                min_year=min_year,
                                                half_life_years=half_life_years)
    print(f"  [{year}] training matches: {len(df_feat):,}, "
          f"half_life={half_life_years or 'default'}y")

    trace = fit_model(df_feat, universe, elo={}, squad=None,
                      draws=draws, tune=tune, chains=chains)
    post = trace.posterior
    att_s = post["att"].stack(sample=("chain", "draw")).to_numpy()
    def_s = post["def"].stack(sample=("chain", "draw")).to_numpy()
    int_s = post["intercept"].stack(sample=("chain", "draw")).to_numpy()
    ha_s = post["home_adv"].stack(sample=("chain", "draw")).to_numpy()
    rho_s = post["rho"].stack(sample=("chain", "draw")).to_numpy()

    rng = np.random.default_rng(year)
    rows = []
    for _, m in wc_matches.iterrows():
        if m["home_team"] not in team_to_idx or m["away_team"] not in team_to_idx:
            continue
        hi = team_to_idx[m["home_team"]]
        ai = team_to_idx[m["away_team"]]
        ph, pd_, pa, eg = predict_match_probs(hi, ai, att_s, def_s, int_s, ha_s, rho_s,
                                              is_neutral=bool(m["neutral"]), rng=rng)
        b, l, c = score_match(ph, pd_, pa, int(m["home_score"]), int(m["away_score"]))
        rows.append({
            "date": m["date"].date(), "home": m["home_team"], "away": m["away_team"],
            "home_score": int(m["home_score"]), "away_score": int(m["away_score"]),
            "p_home": ph, "p_draw": pd_, "p_away": pa, "expected_goals": eg,
            "brier": b, "log_loss": l, "correct": c,
        })

    pm = pd.DataFrame(rows)
    return BackTestResult(
        year=year,
        n_matches=len(pm),
        brier=float(pm["brier"].mean()),
        log_loss=float(pm["log_loss"].mean()),
        accuracy=float(pm["correct"].mean()),
        score_mae=float((pm["expected_goals"] - (pm["home_score"] + pm["away_score"])).abs().mean()),
        per_match=pm,
    )
