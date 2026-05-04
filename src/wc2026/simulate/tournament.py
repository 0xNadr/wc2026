"""Full tournament simulation: 12 groups → R32 → R16 → QF → SF → Final."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..data.tournament import R32_SLOTS, best_thirds_assignment
from .group import simulate_group
from .knockout import play_round


@dataclass
class TournamentResult:
    group_finish: dict[str, list[int]]
    advancing_thirds: list[str]
    r32_winners: list[int]
    r16_winners: list[int]
    qf_winners: list[int]
    sf_winners: list[int]
    runner_up: int
    champion: int


def _rank_thirds(group_finish: dict[str, list[int]],
                 third_pts: dict[str, int],
                 third_gd: dict[str, int],
                 third_gf: dict[str, int],
                 fifa_rank: dict[int, int],
                 rng: np.random.Generator) -> list[str]:
    candidates = list(group_finish.keys())
    def key(g: str) -> tuple:
        third_idx = group_finish[g][2]
        return (-third_pts[g], -third_gd[g], -third_gf[g],
                fifa_rank.get(third_idx, 999), rng.random())
    return sorted(candidates, key=key)[:8]


def _build_r32_pairings(group_finish: dict[str, list[int]],
                        thirds_advancing: list[str]) -> list[tuple[int, int]]:
    third_slot = best_thirds_assignment(thirds_advancing)
    third_team_for_slot = {third_slot[g]: group_finish[g][2] for g in thirds_advancing}

    def resolve(slot: str) -> int:
        if slot.startswith("3-"):
            return third_team_for_slot[slot]
        rank = int(slot[0])
        group = slot[1]
        return group_finish[group][rank - 1]

    return [(resolve(a), resolve(b)) for a, b in R32_SLOTS]


def simulate_tournament(
    groups: dict[str, list[int]],
    att: np.ndarray,
    defe: np.ndarray,
    intercept: float,
    home_adv: float,
    rho: float,
    fifa_rank: dict[int, int],
    rng: np.random.Generator,
) -> TournamentResult:
    group_finish: dict[str, list[int]] = {}
    third_pts: dict[str, int] = {}
    third_gd: dict[str, int] = {}
    third_gf: dict[str, int] = {}

    for letter, team_indices in groups.items():
        outcome = simulate_group(team_indices, att, defe, intercept, home_adv, rho,
                                 fifa_rank, rng)
        group_finish[letter] = outcome.finish
        third_idx = outcome.finish[2]
        third_pts[letter] = outcome.pts[third_idx]
        third_gd[letter] = outcome.gd[third_idx]
        third_gf[letter] = outcome.gf[third_idx]

    advancing_thirds = _rank_thirds(group_finish, third_pts, third_gd, third_gf,
                                    fifa_rank, rng)

    pairings = _build_r32_pairings(group_finish, advancing_thirds)
    r32 = play_round(pairings, att, defe, intercept, home_adv, rho, rng)
    r16 = play_round(list(zip(r32[0::2], r32[1::2])), att, defe, intercept, home_adv, rho, rng)
    qf = play_round(list(zip(r16[0::2], r16[1::2])), att, defe, intercept, home_adv, rho, rng)
    sf = play_round(list(zip(qf[0::2], qf[1::2])), att, defe, intercept, home_adv, rho, rng)
    finalists = sf
    champ = play_round(list(zip(sf[0::2], sf[1::2])), att, defe, intercept, home_adv, rho, rng)[0]
    runner_up = finalists[0] if finalists[1] == champ else finalists[1]

    return TournamentResult(
        group_finish=group_finish,
        advancing_thirds=advancing_thirds,
        r32_winners=r32,
        r16_winners=r16,
        qf_winners=qf,
        sf_winners=sf,
        runner_up=runner_up,
        champion=champ,
    )
