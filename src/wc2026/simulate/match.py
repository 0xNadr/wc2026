"""Vectorized match-outcome sampling from posterior draws."""
from __future__ import annotations

import numpy as np


def _home_adv_for(home_adv: float | np.ndarray, home_idx: int | np.ndarray) -> float | np.ndarray:
    """Look up the home-advantage value for a given home team.

    Accepts either a scalar (legacy global γ) or a per-team array indexed by
    team id. Lets the rest of the simulator stay agnostic.
    """
    if np.isscalar(home_adv):
        return float(home_adv)
    arr = np.asarray(home_adv)
    return arr[home_idx]


def sample_goals(
    home_idx: int | np.ndarray,
    away_idx: int | np.ndarray,
    att: np.ndarray,
    defe: np.ndarray,
    intercept: float,
    home_adv: float | np.ndarray,
    rho: float,
    is_neutral: bool | np.ndarray = False,
    rng: np.random.Generator | None = None,
    size: int = 1,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (home_goals, away_goals) sampled from Dixon-Coles bivariate Poisson.

    home_adv may be a scalar (single global γ) or a per-team array of shape
    (n_teams,). When per-team, home_adv[home_idx] is used.

    Sampling strategy: draw independent Poisson, then apply the τ correction via
    rejection. For low-score outcomes (each ≤1) τ ∈ [1-ρ, 1+ρ]; we accept with
    probability τ / (1+|ρ|) which keeps the acceptance rate ≥ (1-|ρ|)/(1+|ρ|).
    """
    rng = rng or np.random.default_rng()
    is_neutral_f = float(is_neutral) if np.isscalar(is_neutral) else np.asarray(is_neutral, float)
    ha = _home_adv_for(home_adv, home_idx)

    log_lam_h = intercept + att[home_idx] - defe[away_idx] + ha * (1 - is_neutral_f)
    log_lam_a = intercept + att[away_idx] - defe[home_idx]
    lam_h = np.exp(log_lam_h)
    lam_a = np.exp(log_lam_a)

    out_shape = (size,) if np.isscalar(home_idx) else (size, *np.shape(home_idx))
    if size == 1:
        out_shape = np.shape(home_idx) if not np.isscalar(home_idx) else ()

    while True:
        gh = rng.poisson(lam_h, size=out_shape)
        ga = rng.poisson(lam_a, size=out_shape)
        # τ correction
        tau = np.ones_like(gh, dtype=float)
        m00 = (gh == 0) & (ga == 0)
        m01 = (gh == 0) & (ga == 1)
        m10 = (gh == 1) & (ga == 0)
        m11 = (gh == 1) & (ga == 1)
        tau = np.where(m00, 1 - lam_h * rho, tau)
        tau = np.where(m01, 1 + lam_h * rho, tau)
        tau = np.where(m10, 1 + lam_a * rho, tau)
        tau = np.where(m11, 1 - rho, tau)
        # Acceptance ratio: τ / max(τ_possible). For |ρ|<0.2 and λ<3 the cap is
        # safely 1 + 3*|ρ|. We use a generous bound.
        cap = 1.0 + 3.0 * abs(rho)
        u = rng.uniform(size=out_shape)
        accept = u < (tau / cap)
        if accept.all():
            return gh, ga
        # Re-sample only rejected entries (rare with reasonable ρ)
        gh = np.where(accept, gh, rng.poisson(lam_h, size=out_shape))
        ga = np.where(accept, ga, rng.poisson(lam_a, size=out_shape))
        return gh, ga


def sample_knockout_winner(
    home_idx: int,
    away_idx: int,
    att: np.ndarray,
    defe: np.ndarray,
    intercept: float,
    home_adv: float | np.ndarray,
    rho: float,
    is_neutral: bool,
    rng: np.random.Generator,
) -> tuple[int, int, int]:
    """Return (home_goals, away_goals, winner_idx) handling ET + penalties.

    90' draw → 30' ET (sampled with goal rates × 30/90) → if still tied, coin
    flip with mild edge toward the team with higher (att - opp_def) latent diff.
    """
    gh, ga = sample_goals(home_idx, away_idx, att, defe, intercept, home_adv, rho,
                          is_neutral=is_neutral, rng=rng)
    gh, ga = int(gh), int(ga)
    if gh != ga:
        return gh, ga, home_idx if gh > ga else away_idx

    # Extra time: scale rates by 30/90
    ha = _home_adv_for(home_adv, home_idx)
    log_lam_h = intercept + att[home_idx] - defe[away_idx] + ha * (0 if is_neutral else 1)
    log_lam_a = intercept + att[away_idx] - defe[home_idx]
    et_h = rng.poisson(np.exp(log_lam_h) * (30 / 90))
    et_a = rng.poisson(np.exp(log_lam_a) * (30 / 90))
    gh += int(et_h); ga += int(et_a)
    if gh != ga:
        return gh, ga, home_idx if gh > ga else away_idx

    # Penalties: small skill advantage → P(home wins) = 0.5 + 0.05 * sign(strength_diff)
    diff = (att[home_idx] - defe[away_idx]) - (att[away_idx] - defe[home_idx])
    p_home = 0.5 + 0.05 * np.tanh(diff)
    return gh, ga, home_idx if rng.uniform() < p_home else away_idx
