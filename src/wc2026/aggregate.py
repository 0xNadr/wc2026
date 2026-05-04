"""Aggregate Monte Carlo simulation outputs to per-team probabilities + JSON."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np

from .config import OUTPUT
from .simulate.tournament import TournamentResult


def aggregate(results: list[TournamentResult], teams: list[str]) -> dict:
    n = len(results)
    n_teams = len(teams)
    advance_r32 = np.zeros(n_teams, dtype=int)
    advance_r16 = np.zeros(n_teams, dtype=int)
    advance_qf = np.zeros(n_teams, dtype=int)
    advance_sf = np.zeros(n_teams, dtype=int)
    advance_final = np.zeros(n_teams, dtype=int)
    champion = np.zeros(n_teams, dtype=int)
    group_winner = np.zeros(n_teams, dtype=int)
    group_runner = np.zeros(n_teams, dtype=int)
    group_third_advancing = np.zeros(n_teams, dtype=int)
    group_eliminated = np.zeros(n_teams, dtype=int)

    for r in results:
        for letter, finish in r.group_finish.items():
            group_winner[finish[0]] += 1
            group_runner[finish[1]] += 1
            if letter in r.advancing_thirds:
                group_third_advancing[finish[2]] += 1
            else:
                group_eliminated[finish[2]] += 1
            group_eliminated[finish[3]] += 1
        for t in r.r32_winners:
            advance_r16[t] += 1
        for t in r.r16_winners:
            advance_qf[t] += 1
        for t in r.qf_winners:
            advance_sf[t] += 1
        for t in r.sf_winners:
            advance_final[t] += 1
        champion[r.champion] += 1
        # R32 inclusion = top-2 + advancing thirds
        for letter, finish in r.group_finish.items():
            advance_r32[finish[0]] += 1
            advance_r32[finish[1]] += 1
            if letter in r.advancing_thirds:
                advance_r32[finish[2]] += 1

    def per_team(arr: np.ndarray) -> dict[str, float]:
        return {teams[i]: float(arr[i]) / n for i in range(n_teams)}

    return {
        "n_simulations": n,
        "teams": teams,
        "probabilities": {
            "champion": per_team(champion),
            "final": per_team(advance_final),
            "semifinal": per_team(advance_sf),
            "quarterfinal": per_team(advance_qf),
            "round_of_16": per_team(advance_r16),
            "round_of_32": per_team(advance_r32),
            "group_winner": per_team(group_winner),
            "group_runner_up": per_team(group_runner),
            "group_third_advancing": per_team(group_third_advancing),
            "group_eliminated": per_team(group_eliminated),
        },
    }


def sample_alternate_realities(
    results: list[TournamentResult], teams: list[str], k: int = 100
) -> list[dict]:
    """Pick k representative tournament outcomes for the 'alternate realities' UI."""
    rng = np.random.default_rng(0)
    picks = rng.choice(len(results), size=min(k, len(results)), replace=False)
    out = []
    for i in picks:
        r = results[int(i)]
        out.append({
            "champion": teams[r.champion],
            "runner_up": teams[r.runner_up],
            "semifinalists": [teams[t] for t in r.sf_winners],
            "quarterfinalists": [teams[t] for t in r.qf_winners],
            "groups": {g: [teams[t] for t in finish] for g, finish in r.group_finish.items()},
        })
    return out


def write_results(payload: dict, filename: str = "results.json") -> Path:
    path = OUTPUT / filename
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return path
