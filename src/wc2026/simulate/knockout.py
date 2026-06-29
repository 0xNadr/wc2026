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
    match_type_offset: float = 0.0,
    known: dict[frozenset, int] | None = None,
) -> list[int]:
    """Run one knockout round; all matches at neutral venues. Return winners.

    `known` pins already-played ties: it maps the frozenset of the two team
    indices to the index of the team that advanced (after ET/penalties if any),
    so the forecast is conditioned on knockout results so far.
    """
    winners: list[int] = []
    for h, a in pairings:
        fixed = known.get(frozenset((h, a))) if known else None
        if fixed is not None:
            winners.append(fixed)
            continue
        _, _, w = sample_knockout_winner(h, a, att, defe, intercept, home_adv, rho,
                                         is_neutral=True, rng=rng,
                                         match_type_offset=match_type_offset)
        winners.append(w)
    return winners
