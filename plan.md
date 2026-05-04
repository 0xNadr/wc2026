# WC2026 Prediction System — Plan

A Bayesian Monte Carlo simulator for the 2026 FIFA World Cup. One match-outcome
model fitted on a century of international results, 50k tournament rollouts,
all the headline numbers (champion %, group probs, bracket, alternate
realities) emitted as JSON for the frontend to consume.

---

## Project goal

Simulate the tournament many times using:
- **Historical match data** (martj42, 1872 → 2026, ~49k matches)
- **Live team strength** (eloratings.net)
- **Current squad strength** (EA FC 25 player ratings)

Produce per-team probabilities for each tournament stage, plus 100 sample
"alternate reality" brackets, in a static JSON the frontend can render across
the seven planned pages (Champion, Group Stage, Knockout Bracket, Matchup
Predictor, Alternate Realities, Interactive Bracket, Team Stats).

---

## Architecture

```
data sources         feature pipeline       Bayesian model        Monte Carlo            output
──────────────       ────────────────       ──────────────        ─────────────          ──────
martj42 matches  ─►  time-decay weights  ─►  hierarchical    ─►   50k tournament  ─►    results.json
eloratings TSV   ─►  importance weights      Dixon-Coles          rollouts
EA FC 25 CSV     ─►  team prior features     bivariate Poisson    (group sim →
                                             (PyMC, NUTS)         R32 → R16 →
                                                                  QF → SF → Final)
```

### Modeling choice: Bayesian hierarchical Dixon-Coles bivariate Poisson

```
att[i] ~ Normal(att_prior_mu[i], σ_att)   # informed by Elo + squad
def[i] ~ Normal(def_prior_mu[i], σ_def)
log(λ_home) = α + att[home] − def[away] + γ·(1 − is_neutral)
log(λ_away) = α + att[away] − def[home]
likelihood = weighted Dixon-Coles τ(x, y, λ_h, λ_a, ρ) · Pois(x|λ_h) · Pois(y|λ_a)
```

Why this and not XGBoost / a neural net:
- Produces full **scoreline distributions** (free clean sheets, knockout ET, penalties)
- Native uncertainty quantification (every sim draws fresh from posterior)
- Handles sparse-data teams (Curaçao, Cape Verde) via shrinkage to confederation priors
- Standard practitioner baseline; 0.19 Brier on club football, ~0.20 RPS on internationals

---

## What's done

### Data layer ([src/wc2026/data/](src/wc2026/data/))
- [matches.py](src/wc2026/data/matches.py) — martj42 download + canonical team-name normalization. **49,256 matches** loaded, 1872 → 2026-03-31.
- [elo.py](src/wc2026/data/elo.py) — eloratings.net TSV scrape with ISO→team mapping. **48/48 teams matched**.
- [squads.py](src/wc2026/data/squads.py) — EA FC 25 player aggregation (top-23 mean overall). **48/48 teams covered** after handling three phrase variants in the description field ("is a {demonym} footballer", "soccer player", and "{full country name} footballer").
- [tournament.py](src/wc2026/data/tournament.py) — 48 qualified teams, 12 groups, 16 R32 slots, third-placed slot lookup, host-venue mapping.

### Tournament metadata ([src/wc2026/draw.py](src/wc2026/draw.py))
- **Official Dec 5, 2025 FIFA draw** populated as `ACTUAL_DRAW`.
- Pot-based fallback draw (with confederation constraints) for what-if analysis.

### Modeling ([src/wc2026/model/bayesian.py](src/wc2026/model/bayesian.py))
- PyMC hierarchical Dixon-Coles. Centered hierarchy with reparam (`*_raw` ~ N(0,1) plus `σ`).
- Bounded ρ ∈ (−0.15, 0.15) and clipped log(τ) to keep gradients stable.
- Time-decay (2.5-year half-life) × match-importance (W/E/qualifier/friendly) per-match weights via `pm.Potential`.
- **Verified**: 4 chains × 2k draws fit cleanly in ~2.5 min, 0 divergences. Top-of-posterior agrees with practitioner expectations (Argentina, Spain, France, England, Brazil, Portugal up top; intercept ~0.06, home_adv ~0.22, ρ ~−0.02).

### Simulation ([src/wc2026/simulate/](src/wc2026/simulate/))
- [match.py](src/wc2026/simulate/match.py) — Dixon-Coles-corrected Poisson sampler, plus knockout-mode handler with extra time (30/90 rate) and penalty shootout (small skill edge).
- [group.py](src/wc2026/simulate/group.py) — full FIFA tiebreaker chain: pts → GD → GF → H2H → FIFA rank → lots.
- [knockout.py](src/wc2026/simulate/knockout.py), [tournament.py](src/wc2026/simulate/tournament.py) — group → R32 → R16 → QF → SF → Final, with best-third assignment to compatible R32 slots.

### Aggregation ([src/wc2026/aggregate.py](src/wc2026/aggregate.py))
- Per-team per-stage probabilities (champion, final, semi, QF, R16, R32, group winner/RU/3rd-advancing/eliminated).
- 100 sampled "alternate reality" brackets for the UI.
- JSON output shaped for the frontend.

### Runner scripts ([scripts/](scripts/))
- [download_data.py](scripts/download_data.py) — pulls martj42 matches, Elo TSV, and EA FC 25 CSV (via `kagglehub`, no auth needed for public datasets).
- [train.py](scripts/train.py) — fits PyMC, saves trace to `output/traces/dixon_coles.nc`.
- [simulate.py](scripts/simulate.py) — loads trace, runs 50k tournaments, writes `output/results.json`.

### Smoke tests passed
- All imports clean; package installs editable.
- Tournament structure: 48 teams, 12 groups, 16 R32 slots (12 winners + 12 RUs + 8 thirds = 32 ✓).
- Synthetic Elo-only sim (2k tournaments) → Spain 23.6%, Argentina 14.5%, France 13.3% — sane.
- PyMC fit converged with sensible posterior means.

---

## What's next

### Immediate (this session)
- [x] Re-fit PyMC with full 48/48 squad coverage (130s, 0 divergences, trace at [output/traces/dixon_coles.nc](output/traces/dixon_coles.nc))
- [x] Run 50k Monte Carlo sims → [output/results.json](output/results.json) (~6 min, 174 KB)
- [x] Inspect top champion probabilities — model matches current bookmaker market closely (latest run with ZeroSumNormal priors):
  - Spain 18.2%, Argentina 15.1%, France 12.9%, Brazil 9.7%, England 7.4%
  - Portugal 6.3%, Germany 4.6%, Netherlands 4.2%, Colombia 3.3%, Croatia 1.8%

### Golden Boot (top scorer) module — baseline shipped
- [x] **Goalscorers loader** ([src/wc2026/data/goalscorers.py](src/wc2026/data/goalscorers.py)) — pulls martj42 [`goalscorers.csv`](https://github.com/martj42/international_results/blob/master/goalscorers.csv) (47,601 records, 1916 → 2026-03), canonicalizes team names against `TEAM_NAME_MAP`, exposes `scorer_shares()` with exponential time-decay (1.5y half-life, since 2022).
- [x] **Baseline estimator** ([src/wc2026/model/golden_boot.py](src/wc2026/model/golden_boot.py)) — `E[player_goals] = share[team, player] × E[goals/match | team] × E[games | team]`. Per-team E[goals/match] is the posterior mean of `exp(intercept + att − mean(def))`; E[games] is `3 + Σ(stage probs)` from [results.json](output/results.json).
- [x] **Top-3 matches the bookmaker market**: Mbappé 3.41 / Kane 3.24 / Haaland 2.92 expected goals. Top-30 written to [output/golden_boot.csv](output/golden_boot.csv).
- [x] **FC 25 emerging-player floor** ([src/wc2026/data/players.py](src/wc2026/data/players.py), [src/wc2026/model/scorer_share.py](src/wc2026/model/scorer_share.py)) — per-player attacking quality from `position × ((overall − 60)/39)^1.5 × spec_multiplier` (the granular FC 25 attributes ship empty in this Kaggle dump; we use the populated `overall_rating` + `positions` + `specialities` instead). Combined as `share = (1/(1+α))·hist_share + (α/(1+α))·fc25_share` with α=0.5. Player matching across sources via diacritic-fold + double-vowel-collapse + token-subset + difflib fuzzy fallback (handles Haaland↔Håland, Vini Jr↔Vinícius Júnior, Florian Wirtz↔Florian Richard Wirtz). Wirtz now appears at #22, Haaland correctly pulled from 47.7% → 39.2% blended share.
- [x] **Probabilistic Golden Boot** ([model/golden_boot.py:golden_boot_probabilities](src/wc2026/model/golden_boot.py)) — 20k Monte Carlo over posterior draws × independent Poisson(blended_share · per_match_λ · E[games]) per player; argmax tie-broken with uniform jitter. Top-3 P(top scorer): Mbappé 14.0%, Kane 13.4%, Haaland 9.4% — well-calibrated against the bookmaker market. Output at [output/golden_boot_probabilities.csv](output/golden_boot_probabilities.csv).
- [ ] **Squad filter** — apply once 26-man rosters are announced (~2026-06-01); will drop any retired/inactive players still showing in the share data.
- [ ] **Minutes/role adjustment** — once squad lists exist, downweight subs by expected minutes.
- [ ] **Age decay** — current model overrates Messi (P(GB) 7.5%, market closer to 3%) because it doesn't account for age-related decline in scoring rate.
- [ ] **Per-tournament correlation** — current Poisson sampling treats `E[games]` as fixed; a draw with stronger France actually advances France further (so they play more games AND score more per game). Closing this would require re-threading goal-tracking through `simulate_tournament` to track per-tournament team_goals_for and conditioning on the same posterior draw.

### Short-term improvements
- [x] **Sum-to-zero priors** (`ZeroSumNormal`) for `att`/`def` — fixes identifiability between intercept and team effects. Empirically: Brier 0.585 → 0.582 on 2018 (−0.003), wash on 2022, +3pp accuracy on 2022. Champion probabilities barely shifted (sub-1pp), confirming predictions are robust to the prior change.
- [ ] **Per-team home advantage** instead of one global `γ` — opisthokonta data shows it ranges 0.2–0.5 log-goals across nations
- [ ] **Partial home advantage at host venues** — Mexico games near LA, Argentina games in Miami, etc. Encode US/CAN/MEX venues per match in the simulator driver
- [ ] **Sensitivity for Mbappé fitness** — re-run France's strength under (in-full-form, partial, out) and report a range
- [ ] **Encode the FIFA-published THIRDS_LOOKUP** (495 entries, C(12,8)) verbatim from the official source instead of the deterministic-fallback bipartite assignment — currently wrong in edge cases
- [ ] **Verify R32_SLOTS** against FIFA's official bracket diagram — current encoding is structurally valid but pairings may differ

### Validation
- [x] **Back-test on 2018 + 2022 WCs**:
  - 2018: Brier 0.585, log-loss 0.983, accuracy 54.7%, goal-MAE 1.20
  - 2022: Brier 0.568, log-loss 0.971, accuracy 54.7%, goal-MAE 1.42
  - Naive (1/3-1/3-1/3) baseline: Brier 0.667, log-loss 1.099
  - **Conclusion**: ~13% Brier improvement vs naive, 22pp accuracy lift; in line with published academic and bookmaker benchmarks (0.55–0.60 typical for 3-class international-football Brier). Model is competitive; further gains likely from sum-to-zero priors, per-team home advantage, tuned time-decay.
- [ ] Tournament-level back-test: simulate the 2018 and 2022 WCs 10k times each; check whether the actual winners (France, Argentina) fell within the top-3 predicted-probability tier

### Frontend (in progress)
- [x] Next.js 16 + Tailwind v4 + shadcn/ui (Radix Nova preset) at [web/](web/)
- [x] Champion probabilities page (top 12 + stage advance table) at [web/app/page.tsx](web/app/page.tsx)
- [x] Groups page (12 group cards with W/RU/3rd-adv/out probs) at [web/app/groups/page.tsx](web/app/groups/page.tsx)
- [x] **Deployed live at https://wc2026.nader.info/** — Docker container `wc2026-web`, joined to the `proxy` network, Caddy reverse-proxy entry added, Let's Encrypt cert issued
- [ ] Knockout bracket page (SVG visualization)
- [ ] Matchup predictor (team A vs B selector, requires either pre-computed N×N matrix or a FastAPI endpoint)
- [ ] Alternate realities page (browse the 100 sample tournaments)
- [ ] Per-team detail page with full stage probabilities + history
- [ ] Daily nightly re-fit during the tournament (results condition the future-bracket probabilities)

### Deployment (matches existing /opt/apps pattern)
- [Dockerfile](web/Dockerfile): Node 22 multi-stage, Next.js standalone output, `HOSTNAME=0.0.0.0` to bind all interfaces in the container
- [docker-compose.yml](docker-compose.yml): joins external `proxy` network, exposes 3000 internally only
- [.dockerignore](.dockerignore): excludes Python pipeline artifacts (`.venv/`, `data/raw/`, `output/traces/`, `notebooks/`) from the build context
- [/opt/caddy/Caddyfile](/opt/caddy/Caddyfile) entry: `wc2026.nader.info { reverse_proxy wc2026-web:3000 }`
- Deploy via the standard `/opt/apps/deploy.sh wc2026` script (git pull + docker compose build + up -d)

---

## How to run

```bash
cd /opt/apps/wc2026

# One-time: install (creates .venv, installs PyMC + soccerdata + kagglehub)
.venv/bin/pip install -e .

# Pull all raw data (martj42, Elo, EA FC 25) — takes ~30s
.venv/bin/python scripts/download_data.py

# Fit Bayesian Dixon-Coles (4 chains, 2k draws, ~2.5 min on this server)
.venv/bin/python scripts/train.py

# Monte Carlo: 50k tournament rollouts → output/results.json (~5-10 min)
.venv/bin/python scripts/simulate.py
```

---

## Verification checklist before going to production

- [x] 48 qualified teams correct (cross-checked with FIFA: dropped Costa Rica, added Iraq + DR Congo)
- [x] Official Dec 2025 group draw populated
- [x] Squad data covers all 48 teams
- [ ] R32 bracket pairings match FIFA's published diagram
- [ ] FIFA `THIRDS_LOOKUP` table (495-entry combinatorial lookup) populated verbatim
- [ ] Final 26-man squads ingested (announced ~2026-06-01) — currently using EA FC 25 player pool as proxy
- [ ] Mbappé fitness sensitivity re-run done before publishing France's projection
- [ ] Back-test Brier/log-loss against 2018 + 2022 WC actuals

---

## Key data sources

| Source | Records | Notes |
|---|---|---|
| martj42 international results | 49,256 matches (1872–2026-03) | github.com/martj42/international_results |
| eloratings.net | 243 nations, daily-updated | `World.tsv` endpoint |
| EA FC 25 player ratings (sofifa) | 18,205 players | Kaggle: `aniss7/fifa-player-data-from-sofifa-2025-06-03` |
| FIFA Final Draw 2025-12-05 | 12 groups × 4 teams | Hardcoded from FIFA.com / NBC Sports / Wikipedia |

---

## Open questions / decisions deferred

1. **Time-decay tuning**: 2.5-year half-life is a defensible default for international football but should be tuned via cross-validation on the 2018 and 2022 WCs.
2. **Confederation-level priors**: currently we shrink to the global mean; should we use per-confederation means as the shrinkage target for sparse-data teams?
3. **Friendly weight**: 0.30 importance weight is conservative; pre-WC May/June friendlies are arguably the highest-signal data we have. Should pre-tournament friendlies get bumped to 0.50?
4. **Player availability model**: do we model individual player absence (Mbappé out, Messi out) as a discrete shock to the team's att/def, or just run sensitivity scenarios? Probably the latter — we don't have enough player-level historical data to estimate per-player effects on team scoring.
