"""Knockout-stage bracket simulation."""
from __future__ import annotations

import numpy as np

from .match import sample_knockout_winner


def play_round(
    pairings: list[tuple[int, int]],
    att: np.ndarray,
    defe: np.ndarray,
    intercept: float,
    home_adv: float,
    rho: float,
    rng: np.random.Generator,
) -> list[int]:
    """Run one knockout round; all matches at neutral venues. Return winners."""
    winners: list[int] = []
    for h, a in pairings:
        _, _, w = sample_knockout_winner(h, a, att, defe, intercept, home_adv, rho,
                                         is_neutral=True, rng=rng)
        winners.append(w)
    return winners
