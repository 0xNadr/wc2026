"""Baseline Golden Boot estimator.

Combines three quantities to rank players by expected tournament goals:

  E[player_goals] = share[team, player] × E[goals_per_match | team] × E[games | team]

  - share is the player's exponentially-decayed historical share of their
    nation's international goals (from goalscorers.csv).
  - E[goals_per_match] is the team's posterior-mean λ against an "average"
    opponent (intercept + att[t] − mean(def), neutral venue).
  - E[games] is derived from the simulator's stage probabilities:
        3 (group games) + P(R32) + P(R16) + P(QF) + P(SF) + P(Final)

Caveats — what this baseline does NOT do (call out in any output):
  - No squad filter. Players who retired between their last goal and the WC
    will appear in the historical-share data (e.g. Lewandowski, Modrić if
    they retire). Once 26-man squads are announced (~2026-06-01) we filter.
  - No minutes/role model. A regular starter and a sub with the same
    historical share are treated equally.
  - No partial-home-advantage adjustment for USA/CAN/MEX matches.
  - Point estimate only; no probability of *winning* Golden Boot (would need
    per-tournament per-player goal sampling, ~10× current sim cost).
"""
from __future__ import annotations

import json
from pathlib import Path

import arviz as az
import numpy as np
import pandas as pd

from ..config import OUTPUT, RANDOM_SEED
from .scorer_share import DEFAULT_ALPHA, DEFAULT_HALFLIFE, DEFAULT_SINCE, blended_shares


STAGE_KEYS_FOR_GAMES = (
    "round_of_32",
    "round_of_16",
    "quarterfinal",
    "semifinal",
    "final",
)


def expected_games_per_team(probabilities: dict) -> dict[str, float]:
    """3 group games + sum of (probability of playing each knockout stage)."""
    out: dict[str, float] = {}
    teams = probabilities["champion"].keys()
    for t in teams:
        ko = sum(probabilities[k][t] for k in STAGE_KEYS_FOR_GAMES)
        out[t] = 3.0 + ko
    return out


def expected_goals_per_match(trace: az.InferenceData) -> dict[str, float]:
    """E[λ_score | team t, neutral, average opponent] from posterior means."""
    post = trace.posterior
    teams = list(post.coords["team"].values)
    att = post["att"].mean(("chain", "draw")).to_numpy()
    defe = post["def"].mean(("chain", "draw")).to_numpy()
    intercept = float(post["intercept"].mean())
    avg_def = float(defe.mean())
    log_lam = intercept + att - avg_def
    lam = np.exp(log_lam)
    return {str(t): float(lam[i]) for i, t in enumerate(teams)}


def expected_team_total_goals(
    trace: az.InferenceData, probabilities: dict
) -> dict[str, float]:
    """Per-team expected goals scored across the entire tournament."""
    per_match = expected_goals_per_match(trace)
    games = expected_games_per_team(probabilities)
    return {t: per_match[t] * games[t] for t in per_match if t in games}


def golden_boot_table(
    trace: az.InferenceData,
    results_path: Path | str = OUTPUT / "results.json",
    *,
    alpha: float = DEFAULT_ALPHA,
    since: str = DEFAULT_SINCE,
    half_life_years: float = DEFAULT_HALFLIFE,
    top_k: int = 30,
) -> pd.DataFrame:
    """Return a ranked DataFrame of expected tournament goals per player.

    Uses blended share = (1/(1+α))·hist_share + (α/(1+α))·fc25_share so that
    emergers (Yamal/Wirtz/Endrick) get a per-player floor from FC 25 ratings.

    Columns: rank, scorer, team, blended_share, hist_share, fc25_share,
             expected_team_goals, expected_player_goals, n_recent_goals.
    """
    payload = json.loads(Path(results_path).read_text())
    probabilities = payload["probabilities"]
    team_totals = expected_team_total_goals(trace, probabilities)

    shares = blended_shares(
        list(team_totals.keys()),
        alpha=alpha, since=since, half_life_years=half_life_years,
    )
    shares["expected_team_goals"] = shares["team"].map(team_totals)
    shares["expected_player_goals"] = shares["blended_share"] * shares["expected_team_goals"]

    out = (
        shares.sort_values("expected_player_goals", ascending=False)
        .reset_index(drop=True)
        .head(top_k)
    )
    out.insert(0, "rank", out.index + 1)
    return out[[
        "rank", "scorer", "team", "blended_share", "hist_share", "fc25_share",
        "expected_team_goals", "expected_player_goals", "n_recent_goals",
    ]]


def _per_match_lam_samples(trace: az.InferenceData) -> tuple[list[str], np.ndarray]:
    """Per-team E[goals/match | neutral, average opponent] for every posterior draw.

    Returns (teams, samples) where samples has shape (n_draws, n_teams).
    """
    post = trace.posterior
    teams = list(post.coords["team"].values)
    att = post["att"].stack(sample=("chain", "draw")).to_numpy()  # (team, sample)
    defe = post["def"].stack(sample=("chain", "draw")).to_numpy()
    intercept = post["intercept"].stack(sample=("chain", "draw")).to_numpy()
    avg_def = defe.mean(axis=0, keepdims=True)
    log_lam = intercept[None, :] + att - avg_def
    return [str(t) for t in teams], np.exp(log_lam).T  # (sample, team)


def golden_boot_probabilities(
    trace: az.InferenceData,
    results_path: Path | str = OUTPUT / "results.json",
    *,
    alpha: float = DEFAULT_ALPHA,
    since: str = DEFAULT_SINCE,
    half_life_years: float = DEFAULT_HALFLIFE,
    n_sims: int = 20_000,
    top_k: int = 30,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    """Per-player P(wins Golden Boot) by Monte Carlo over posterior + scoring noise.

    Each simulation:
      1. Pick a random posterior draw → per-team λ_per_match.
      2. For each (team, player), λ_p = blended_share[p] · λ_per_match[t] · E[games | t].
      3. Sample player_goals ~ Poisson(λ_p) independently.
      4. Argmax over all players → tournament's top scorer.
      5. Tie-break by sampling earliest-in-tournament timestamp uniformly.

    P(top scorer) = fraction of sims where player wins. Returns top_k by P.
    """
    payload = json.loads(Path(results_path).read_text())
    probabilities = payload["probabilities"]
    games_per_team = expected_games_per_team(probabilities)

    teams, lam_samples = _per_match_lam_samples(trace)
    team_to_idx = {t: i for i, t in enumerate(teams)}
    n_draws = lam_samples.shape[0]

    # Restrict to qualified teams: non-qualified teams (e.g. Guam in the wider
    # training universe) never play tournament matches, so their players cannot
    # win the Golden Boot. Defaulting their games to 0 zeros out their goals.
    games_arr = np.array([games_per_team.get(t, 0.0) for t in teams])

    qualified_teams = set(games_per_team)
    shares = blended_shares(teams, alpha=alpha, since=since, half_life_years=half_life_years)
    shares = shares[shares["team"].isin(qualified_teams)]
    shares = shares[shares["blended_share"] > 0].reset_index(drop=True)
    shares["team_idx"] = shares["team"].map(team_to_idx)
    shares = shares.dropna(subset=["team_idx"])
    shares["team_idx"] = shares["team_idx"].astype(int)

    blend = shares["blended_share"].to_numpy()
    t_idx = shares["team_idx"].to_numpy()

    rng = np.random.default_rng(seed)
    wins = np.zeros(len(shares), dtype=np.int64)

    chunk = 1000
    for chunk_start in range(0, n_sims, chunk):
        n_this = min(chunk, n_sims - chunk_start)
        draws = rng.integers(0, n_draws, size=n_this)
        # (n_this, n_teams)
        lam_per_match = lam_samples[draws]
        # (n_this, n_players)
        lam_player = blend[None, :] * lam_per_match[:, t_idx] * games_arr[t_idx][None, :]
        goals = rng.poisson(lam_player)
        # Tie-break by uniform jitter so ties between players don't always go to
        # the lowest-index player.
        jitter = rng.uniform(0, 0.5, size=goals.shape)
        winners = (goals + jitter).argmax(axis=1)
        np.add.at(wins, winners, 1)

    shares["p_top_scorer"] = wins / n_sims
    shares["expected_team_goals"] = (
        lam_samples.mean(axis=0)[t_idx] * games_arr[t_idx]
    )
    shares["expected_player_goals"] = shares["blended_share"] * shares["expected_team_goals"]

    out = (
        shares.sort_values("p_top_scorer", ascending=False)
        .reset_index(drop=True)
        .head(top_k)
    )
    out.insert(0, "rank", out.index + 1)
    return out[[
        "rank", "scorer", "team", "blended_share",
        "expected_team_goals", "expected_player_goals", "p_top_scorer",
    ]]
