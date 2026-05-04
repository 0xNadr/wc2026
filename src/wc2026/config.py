from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
OUTPUT = ROOT / "output"

for _p in (DATA_RAW, DATA_PROCESSED, OUTPUT):
    _p.mkdir(parents=True, exist_ok=True)

TOURNAMENT_START = date(2026, 6, 11)
TOURNAMENT_END = date(2026, 7, 19)

# Time-decay half-life for international football (years).
# Cross-validated on 2018 + 2022 World Cup back-tests (see scripts/sweep_halflife.py
# and output/halflife_sweep.json). Best avg Brier at 4.0y (0.5745) vs 2.5y (0.5748);
# the model is robust in the 2.5-4.0y range, but 1.0y costs ~0.014 Brier.
TIME_DECAY_HALFLIFE_YEARS = 4.0

# Match-importance weights (Elo K-factor inspired).
MATCH_WEIGHTS = {
    "FIFA World Cup": 1.00,
    "FIFA World Cup qualification": 0.65,
    "UEFA Euro": 0.85,
    "UEFA Euro qualification": 0.55,
    "Copa América": 0.85,
    "African Cup of Nations": 0.75,
    "AFC Asian Cup": 0.70,
    "CONCACAF Gold Cup": 0.65,
    "UEFA Nations League": 0.55,
    "Friendly": 0.30,
}
DEFAULT_MATCH_WEIGHT = 0.45

N_SIMULATIONS = 50_000
RANDOM_SEED = 26
