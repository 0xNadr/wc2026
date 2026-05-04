# WC 2026 Forecaster

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Bayesian Monte Carlo simulator for the 2026 FIFA World Cup. Fits a hierarchical
Dixon-Coles bivariate Poisson model on a century of international results, draws
50,000 posterior tournament rollouts, and serves the aggregated probabilities
through a Next.js dashboard.

Live: <https://wc2026.nader.info>

> Educational and research project. Probabilities are model output, not betting
> advice; calibration is good but the tail is wide. Past performance does not
> predict future tournaments.

## What it produces

- Per-team probabilities of winning the group, advancing, reaching each
  knockout round, and lifting the trophy.
- Pairwise match probabilities for all 48 × 48 team combinations (W/D/L,
  expected goals, modal scoreline) at a neutral venue.
- Per-player expected goals and P(wins Golden Boot) via 20k Monte Carlo
  draws on per-player Poisson rates.
- An interactive bracket and scenario explorer, and a methodology page
  documenting priors, weights, and back-test calibration.

Back-test on 2018 + 2022 World Cups: Brier 0.57-0.58, accuracy 55-58%, in line
with FiveThirtyEight SPI and bookmaker-grade systems.

## Project layout

```
src/wc2026/         Python package
  data/             loaders for matches, Elo, EA FC 25, goalscorers, squads
  model/            PyMC Dixon-Coles fit, golden-boot, scorer-share
  simulate/         tournament rollout (groups -> R32 -> Final)
  draw.py           hardcoded official 2025-12 final draw
  config.py         priors, half-life, importance weights
scripts/            end-to-end pipeline entry points
data/raw/           downloaded inputs (gitignored)
data/processed/     intermediate parquet (gitignored)
output/             results.json, matchups.json, traces, charts, report.pdf
web/                Next.js 15 frontend (App Router, Tailwind, shadcn/ui)
```

## Reproduce the pipeline

End-to-end runs in ~25 min on a modest VPS. Requires Python 3.12.

```bash
# install
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# run
python scripts/download_data.py     # martj42 matches + Elo + EA FC 25 + goalscorers
python scripts/train.py             # PyMC NUTS, 4 chains x 2k draws on ~31k matches
python scripts/simulate.py          # 50,000 tournament rollouts -> results.json
python scripts/compute_matchups.py  # 2,256 pairwise probabilities
python scripts/golden_boot.py       # per-player goal expectations + P(GB)
python scripts/export_team_meta.py  # team metadata for the frontend
python scripts/export_squads.py     # top-23 EA FC 25 rosters per team

# optional
python scripts/sweep_halflife.py    # cross-validate time-decay
python scripts/backtest.py          # 2018 + 2022 calibration metrics
python scripts/generate_eda.py      # 10 EDA charts
python scripts/generate_report.py   # PDF technical report
```

## Run the frontend

```bash
cd web
npm install
npm run dev    # http://localhost:3000
```

The frontend reads JSON from `web/public/*.json`, which are symlinks into
`output/`, so re-running the pipeline immediately refreshes the dashboard.

## Deploy

`docker-compose.yml` builds the Next.js app in standalone mode, copies the
pipeline outputs into `public/` at build time, and serves on port 3000 inside
a `proxy` external network for Caddy.

```bash
docker compose up -d --build
```

The container is mem-capped at 256 MB.

## The model in one paragraph

Goals scored by each side are modelled as Poisson with team-specific rates:
`log(lambda) = alpha + att[team] - def[opponent] + gamma * (1 - is_neutral)`.
The two scorelines are coupled by the Dixon-Coles tau correction on the four
lowest-score cells. Every parameter has a prior; we fit by NUTS in PyMC. Att
and def use ZeroSumNormal priors anchored by current Elo (70%) and EA FC 25
top-23 squad strength (30%). Matches are weighted by `exp(-ln 2 * age / 2.5)
* importance`, where importance follows the Elo K-factor convention (WC 1.0,
qualifiers 0.65, friendlies 0.30). The simulator draws one full posterior
sample per tournament, so the final probabilities propagate the model's full
uncertainty rather than a point estimate. The methodology page on the live
site documents the rest.

## Data sources

- 49,256 international match results 1872 -> 2026-03-31 (martj42/international_results)
- Per-goal records with scorer, minute, penalty/own-goal flags (same repo)
- Live Elo ratings for the 48 qualified teams (eloratings.net)
- EA FC 25 player ratings for 18,205 footballers (Kaggle)
- Official FIFA Final Draw (5 December 2025, Washington DC)

## Contributing

Issues and pull requests welcome — bug reports, methodology critiques, or
data-source suggestions are all useful. For larger changes (new model
component, alternative simulation strategy), open an issue first so we can
agree on scope.

## Citing

If you use this work in a paper or post, a link back to the repository is
appreciated:

```
Bennour, N. (2026). WC 2026 Forecaster: a hierarchical Bayesian model for
the 2026 FIFA World Cup. https://github.com/0xNadr/wc2026
```

## License

[MIT](LICENSE) © 2026 Nader Bennour.

The code is MIT-licensed. Upstream data sources retain their own terms — in
particular, EA FC 25 ratings and `martj42/international_results` are reused
under the licenses listed in their respective repositories.
