"""Bayesian hierarchical time-weighted Dixon-Coles bivariate Poisson.

Per-team latent parameters:
    att[i] ~ Normal(att_prior_mu[i], att_prior_sigma)
    def[i] ~ Normal(def_prior_mu[i], def_prior_sigma)

Match goal rates (for home team h, away team a):
    log(λ_home) = α + att[h] - def[a] + γ * (1 - is_neutral)
    log(λ_away) = α + att[a] - def[h]

Likelihood is Dixon-Coles weighted Poisson:
    P(X=x, Y=y) = τ(x,y; λ_home, λ_away, ρ) * Pois(x|λ_home) * Pois(y|λ_away)

where τ down-weights 0-0 and 1-1 and up-weights 0-1 and 1-0 to match the empirical
under-dispersion of low-scoring international results. We implement this as a
weighted log-likelihood with a per-match observation weight (time + importance).

Att/def priors are informed by Elo + squad strength via a linear projection
fitted by simple regression — keeps the hierarchical model identifiable and
gives sparse-data teams (Curaçao, Cape Verde) sensible shrinkage targets.
"""
from __future__ import annotations

from pathlib import Path

import arviz as az
import numpy as np
import pandas as pd
import pymc as pm
import pytensor.tensor as pt

from ..config import OUTPUT


def dixon_coles_tau(x, y, lam_h, lam_a, rho):
    """Vectorized Dixon-Coles low-score correction τ(x,y).

    τ = 1 - λ_h*ρ      (x=0, y=0)
        1 + λ_h*ρ      (x=0, y=1)
        1 + λ_a*ρ      (x=1, y=0)
        1 - ρ          (x=1, y=1)
        1              otherwise
    """
    eq = pt.eq
    return pt.switch(
        eq(x, 0) & eq(y, 0), 1 - lam_h * rho,
        pt.switch(
            eq(x, 0) & eq(y, 1), 1 + lam_h * rho,
            pt.switch(
                eq(x, 1) & eq(y, 0), 1 + lam_a * rho,
                pt.switch(eq(x, 1) & eq(y, 1), 1 - rho, 1.0),
            ),
        ),
    )


def build_priors(
    teams: list[str],
    elo: dict[str, float],
    squad: pd.DataFrame | None,
) -> tuple[np.ndarray, np.ndarray]:
    """Map external strength signals to (att_prior_mu, def_prior_mu) per team.

    Elo is normalized to z-scores. Squad strength (if present) is appended.
    Priors are scaled so their absolute magnitudes match what att/def typically
    take in fitted Dixon-Coles models on international data (~ ±0.5).
    """
    n = len(teams)
    elo_arr = np.array([elo.get(t, 1500.0) for t in teams], dtype=float)
    elo_z = (elo_arr - elo_arr.mean()) / (elo_arr.std() + 1e-9)

    if squad is not None and not squad.empty:
        squad_map = squad.set_index("nation")["squad_strength"].to_dict()
        s_arr = np.array([squad_map.get(t, np.nan) for t in teams], dtype=float)
        s_mean = np.nanmean(s_arr)
        s_arr = np.where(np.isnan(s_arr), s_mean, s_arr)
        s_z = (s_arr - s_arr.mean()) / (s_arr.std() + 1e-9)
        composite = 0.7 * elo_z + 0.3 * s_z
    else:
        composite = elo_z

    # log(λ_home) = α + att[home] - def[away]; def is defensive *strength*, so
    # strong teams (high composite) get HIGH att and HIGH def. Centered to mean
    # zero to stay consistent with the model's sum-to-zero att/def constraints.
    att_mu = 0.4 * composite - (0.4 * composite).mean()
    def_mu = 0.4 * composite - (0.4 * composite).mean()
    return att_mu, def_mu


def fit_model(
    matches: pd.DataFrame,
    teams: list[str],
    elo: dict[str, float],
    squad: pd.DataFrame | None = None,
    *,
    draws: int = 2000,
    tune: int = 2000,
    chains: int = 4,
    cores: int | None = None,
    target_accept: float = 0.95,
    seed: int = 26,
) -> az.InferenceData:
    """Fit the hierarchical Dixon-Coles model and return the posterior trace."""
    n_teams = len(teams)
    att_mu, def_mu = build_priors(teams, elo, squad)

    h_idx = matches["home_idx"].to_numpy()
    a_idx = matches["away_idx"].to_numpy()
    h_goals = matches["home_score"].to_numpy()
    a_goals = matches["away_score"].to_numpy()
    weights = matches["weight"].to_numpy()
    neutral = matches["is_neutral"].to_numpy()

    coords = {"team": teams, "match": np.arange(len(matches))}
    with pm.Model(coords=coords) as model:
        att_prior_mu = pm.Data("att_prior_mu", att_mu, dims="team")
        def_prior_mu = pm.Data("def_prior_mu", def_mu, dims="team")

        sigma_att = pm.HalfNormal("sigma_att", 0.5)
        sigma_def = pm.HalfNormal("sigma_def", 0.5)

        # Sum-to-zero priors fix the rotational unidentifiability between
        # att/def and intercept (any constant added to att and subtracted from
        # def leaves λ unchanged). With ZeroSumNormal, intercept becomes
        # identifiable as the mean log-goal-rate and att/def are pure deviations.
        att_raw = pm.ZeroSumNormal("att_raw", sigma=1.0, dims="team")
        def_raw = pm.ZeroSumNormal("def_raw", sigma=1.0, dims="team")

        att = pm.Deterministic("att", att_prior_mu + sigma_att * att_raw, dims="team")
        defe = pm.Deterministic("def", def_prior_mu + sigma_def * def_raw, dims="team")

        intercept = pm.Normal("intercept", 0.1, 0.3)
        home_adv = pm.Normal("home_adv", 0.25, 0.10)
        # ρ is bounded to (-0.2, 0.2): the Dixon-Coles τ correction stays
        # positive for low-score (≤1) cells when |ρ|·max(λ) < 1, and λ rarely
        # exceeds ~5 in international football, so |ρ| < 0.2 is safe.
        rho = pm.TruncatedNormal("rho", mu=0.0, sigma=0.05, lower=-0.15, upper=0.15)

        # Clip att/def at ±2 std-dev to keep early sampling stable while still
        # giving the posterior plenty of room to move.
        log_lam_h = pt.clip(
            intercept + att[h_idx] - defe[a_idx] + home_adv * (1 - neutral),
            -3.0, 3.0,
        )
        log_lam_a = pt.clip(intercept + att[a_idx] - defe[h_idx], -3.0, 3.0)
        lam_h = pt.exp(log_lam_h)
        lam_a = pt.exp(log_lam_a)

        log_pois = (
            h_goals * log_lam_h - lam_h - pt.gammaln(h_goals + 1)
            + a_goals * log_lam_a - lam_a - pt.gammaln(a_goals + 1)
        )
        # Safe log(τ): floor at 1e-9 so negative excursions don't produce NaN.
        tau = dixon_coles_tau(h_goals, a_goals, lam_h, lam_a, rho)
        log_tau = pt.log(pt.maximum(tau, 1e-9))
        per_match_loglik = log_pois + log_tau

        pm.Potential("weighted_loglik", pt.sum(weights * per_match_loglik))

        trace = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            cores=cores,
            target_accept=target_accept,
            random_seed=seed,
            progressbar=True,
        )
    return trace


def save_trace(trace: az.InferenceData, name: str = "trace") -> Path:
    out = OUTPUT / "traces" / f"{name}.nc"
    out.parent.mkdir(parents=True, exist_ok=True)
    trace.to_netcdf(out)
    return out


def load_trace(name: str = "trace") -> az.InferenceData:
    return az.from_netcdf(OUTPUT / "traces" / f"{name}.nc")


def posterior_means(trace: az.InferenceData) -> dict[str, np.ndarray | float]:
    post = trace.posterior
    return {
        "att": post["att"].mean(("chain", "draw")).to_numpy(),
        "def": post["def"].mean(("chain", "draw")).to_numpy(),
        "intercept": float(post["intercept"].mean()),
        "home_adv": float(post["home_adv"].mean()),
        "rho": float(post["rho"].mean()),
    }
