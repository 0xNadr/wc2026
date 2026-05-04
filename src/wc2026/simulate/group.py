"""Group-stage simulation with FIFA tiebreakers."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .match import sample_goals


@dataclass
class GroupOutcome:
    finish: list[int]   # team indices in finishing order (1st..4th)
    pts: dict[int, int]
    gd: dict[int, int]
    gf: dict[int, int]


def simulate_group(
    team_indices: list[int],
    att: np.ndarray,
    defe: np.ndarray,
    intercept: float,
    home_adv: float,
    rho: float,
    fifa_rank: dict[int, int],
    rng: np.random.Generator,
) -> GroupOutcome:
    """Play all 6 group fixtures, return finishing order + per-team stats.

    Group games are treated as neutral; host-nation venue boosts (if any) are
    applied at the tournament-driver level, not here.

    Tiebreak chain: pts → GD → GF → H2H pts → H2H GD → H2H GF →
    FIFA ranking → drawing of lots.
    """
    n = len(team_indices)
    pts = np.zeros(n, dtype=int)
    gf = np.zeros(n, dtype=int)
    ga = np.zeros(n, dtype=int)
    h2h_pts = np.zeros((n, n), dtype=int)
    h2h_gd = np.zeros((n, n), dtype=int)
    h2h_gf = np.zeros((n, n), dtype=int)

    for i in range(n):
        for j in range(i + 1, n):
            home, away = team_indices[i], team_indices[j]
            gh, ga_ = sample_goals(home, away, att, defe, intercept, home_adv, rho,
                                   is_neutral=True, rng=rng)
            gh, ga_ = int(gh), int(ga_)
            gf[i] += gh; ga[i] += ga_
            gf[j] += ga_; ga[j] += gh
            if gh > ga_:
                pts[i] += 3; h2h_pts[i, j] += 3
            elif gh < ga_:
                pts[j] += 3; h2h_pts[j, i] += 3
            else:
                pts[i] += 1; pts[j] += 1
                h2h_pts[i, j] += 1; h2h_pts[j, i] += 1
            h2h_gd[i, j] += gh - ga_; h2h_gd[j, i] += ga_ - gh
            h2h_gf[i, j] += gh; h2h_gf[j, i] += ga_

    gd = gf - ga

    def sort_key(i: int) -> tuple:
        return (-pts[i], -gd[i], -gf[i], fifa_rank.get(team_indices[i], 999), rng.random())

    order = sorted(range(n), key=sort_key)

    final: list[int] = []
    i = 0
    while i < len(order):
        j = i
        while (j + 1 < len(order)
               and pts[order[j + 1]] == pts[order[i]]
               and gd[order[j + 1]] == gd[order[i]]
               and gf[order[j + 1]] == gf[order[i]]):
            j += 1
        block = order[i:j + 1]
        if len(block) > 1:
            block = sorted(block, key=lambda k: (
                -sum(h2h_pts[k, m] for m in block if m != k),
                -sum(h2h_gd[k, m] for m in block if m != k),
                -sum(h2h_gf[k, m] for m in block if m != k),
                fifa_rank.get(team_indices[k], 999),
                rng.random(),
            ))
        final.extend(block)
        i = j + 1

    finish = [team_indices[k] for k in final]
    return GroupOutcome(
        finish=finish,
        pts={team_indices[k]: int(pts[k]) for k in range(n)},
        gd={team_indices[k]: int(gd[k]) for k in range(n)},
        gf={team_indices[k]: int(gf[k]) for k in range(n)},
    )
