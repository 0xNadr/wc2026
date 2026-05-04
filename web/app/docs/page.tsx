import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CitationBlock, DocsScrollTracker } from "@/components/docs-engagement";

export const metadata = {
  title: "Methodology · WC 2026 Forecaster",
};

const CITATION = `Bennour, N. (2026). WC 2026 Forecaster: a hierarchical Bayesian model for the 2026 FIFA World Cup. https://github.com/0xNadr/wc2026`;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted/50 border border-border/50 rounded-md p-3 text-[12px] font-mono overflow-x-auto leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Math({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 border-l-2 border-emerald-500/60 px-4 py-2 my-2 font-mono text-[13px]">
      {children}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <DocsScrollTracker />
      <section className="space-y-2">
        <Badge variant="outline" className="text-xs">📚 Methodology</Badge>
        <h1 className="text-3xl font-bold tracking-tight">How the model works</h1>
        <p className="text-muted-foreground">
          A Bayesian hierarchical Dixon-Coles bivariate Poisson model, fitted on a century of
          international football, simulated forward 50,000 times. This page explains every layer
          of the pipeline, the data, the calibration, and where it can still improve.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>The model in one paragraph</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            For each match between teams <em>h</em> (home) and <em>a</em> (away), we model the
            number of goals scored by each side as Poisson with team-specific rates. Each team
            has a latent <strong>attack</strong> parameter and a latent <strong>defense</strong>{" "}
            parameter; goal rates are exponentials of the appropriate combination plus a global
            home-advantage bonus and intercept:
          </p>
          <Math>
            log(λ<sub>home</sub>) = α + att[h] − def[a] + γ · (1 − is_neutral)
            <br />
            log(λ<sub>away</sub>) = α + att[a] − def[h]
          </Math>
          <p>
            The two scorelines are <em>not</em> independent at the low end. International
            football has a small but persistent surplus of 0-0 / 1-1 / 0-1 / 1-0 results compared
            to what independent Poisson predicts. Dixon &amp; Coles (1997) handle this with a
            correction factor τ that adjusts only the four lowest-score cells:
          </p>
          <Math>P(X=x, Y=y) ∝ τ(x, y; λ<sub>h</sub>, λ<sub>a</sub>, ρ) · Pois(x | λ<sub>h</sub>) · Pois(y | λ<sub>a</sub>)</Math>
          <p>
            We're <em>Bayesian</em> about it: every parameter is given a prior, and we fit by
            sampling the joint posterior with NUTS (the modern descendant of HMC). Each
            simulated tournament draws fresh values for every parameter, so the final
            probabilities propagate the model's full uncertainty, not just a point estimate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why this model, and not XGBoost or a neural net</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Scoreline distributions for free.</strong> A classifier for 1X2 outcomes
              tells you P(W/D/L); a goal-rate model tells you the entire distribution over
              scorelines, which falls out naturally into clean sheets, knockout-stage extra time,
              penalty shootout edges, and Golden Boot expected goals.
            </li>
            <li>
              <strong>Calibrated uncertainty.</strong> XGBoost gives a point probability per
              match; Bayesian inference gives a posterior over the entire <em>function</em>. When
              we draw 50,000 different posterior samples and simulate 50,000 different
              tournaments, we're propagating both the model's parametric uncertainty <em>and</em>{" "}
              the inherent randomness of football outcomes.
            </li>
            <li>
              <strong>Sparse-data teams behave correctly.</strong> Curaçao has played far fewer
              international matches than France. A flat estimator over-fits to its noise; the
              hierarchical model shrinks Curaçao's att/def toward a population mean and inflates
              its uncertainty automatically.
            </li>
            <li>
              <strong>The literature.</strong> Dixon-Coles is the practitioner baseline.
              FiveThirtyEight's SPI, Octosport, and most peer-reviewed football models use it or
              close variants. Beating it consistently with neural nets requires event-level data
              (StatsBomb-grade) that doesn't exist for most international fixtures.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priors: how Elo + EA FC 25 inform the model</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            Plain Dixon Coles has a famous identifiability problem: adding a constant to every
            att and subtracting it from the intercept yields the same likelihood. To fix this and
            inject external information, we use:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>ZeroSumNormal priors</strong> on att and def, forcing them to sum to zero
              by construction. Now the intercept α has the unambiguous interpretation "average
              log-goal-rate across all teams" and att/def are pure deviations.
            </li>
            <li>
              <strong>Informative priors</strong> on the att/def means, anchored by current Elo
              (z-scored, 70%) and EA FC 25 squad strength (top-23 mean overall, z-scored, 30%).
              This is the cleanest way to bring 2026-current information into a model whose
              training data goes back to the 1990s.
            </li>
            <li>
              <strong>Hyperpriors</strong> on the spread (HalfNormal scale, σ ~ HalfNormal(0.5))
              control how far team strengths can deviate from the prior mean. The data drives
              this. If matches strongly disagree with Elo, σ inflates and the data wins.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match weights: time decay × tournament importance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            International football data goes back to 1872. Spain in 1880 has nothing to do with
            Spain in 2026. We weight every match in the likelihood by:
          </p>
          <Math>
            weight = exp(−ln(2) · age_years / 2.5) · importance
          </Math>
          <p>
            The time decay half life is 2.5 years, much longer than club football (typically
            3-6 months) because national team rosters turn over slowly. The importance term
            follows the Elo K-factor convention: World Cup matches at 1.0, qualifiers at 0.65,
            major continental tournaments at 0.85, friendlies at 0.30 (managers experiment, the
            signal is weaker).
          </p>
          <p>
            Pre-tournament friendlies in May and June 2026 will be the highest-signal data we
            ever get for the actual matches we're about to predict. The model will keep
            updating as those land.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The simulator: from match probabilities to tournament probabilities</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>The Bayesian model gives us per-match scoreline distributions. To get tournament-level numbers:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Draw <em>one</em> random sample from the posterior (one set of att, def, intercept,
              home_adv, ρ values).
            </li>
            <li>
              Sample all 6 group-stage fixtures for each of the 12 groups via Dixon-Coles-corrected
              Poisson, apply the full FIFA tiebreak chain (points → GD → GF → head-to-head → FIFA
              rank → drawing of lots).
            </li>
            <li>
              Determine the 8 best third-placed teams by FIFA's published criteria and assign them
              to compatible R32 slots.
            </li>
            <li>
              Run the bracket through R32 → R16 → QF → SF → Final, with extra-time goal rates
              scaled to 30/90 of regulation, and a small skill edge in penalty shootouts (~55/45
              for the favorite).
            </li>
            <li>Repeat 50,000 times. Aggregate.</li>
          </ol>
          <p>
            The <Link href="/alternate" className="underline">Alternate Realities</Link> page shows
            100 of these tournaments individually so you can see what the spread looks like.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calibration: how do we know it's actually good?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>We back-tested by re-fitting the model on data available <em>before</em> each World Cup, then predicting all 64 matches:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1 font-medium">Year</th>
                  <th className="text-right py-1 font-medium">n</th>
                  <th className="text-right py-1 font-medium">Brier ↓</th>
                  <th className="text-right py-1 font-medium">Log-loss ↓</th>
                  <th className="text-right py-1 font-medium">Accuracy ↑</th>
                  <th className="text-right py-1 font-medium">Goal MAE ↓</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                <tr className="border-b border-border/30">
                  <td className="py-1">2018</td>
                  <td className="text-right">64</td>
                  <td className="text-right">0.582</td>
                  <td className="text-right">0.978</td>
                  <td className="text-right">54.7%</td>
                  <td className="text-right">1.20</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1">2022</td>
                  <td className="text-right">64</td>
                  <td className="text-right">0.569</td>
                  <td className="text-right">0.971</td>
                  <td className="text-right">57.8%</td>
                  <td className="text-right">1.42</td>
                </tr>
                <tr className="text-muted-foreground">
                  <td className="py-1">Naive (1/3-1/3-1/3)</td>
                  <td className="text-right">N/A</td>
                  <td className="text-right">0.667</td>
                  <td className="text-right">1.099</td>
                  <td className="text-right">33.3%</td>
                  <td className="text-right">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Brier score on a 3-class (W/D/L) outcome is bounded above by 2.0; the naive uniform
            forecast gets 0.667. A Brier of 0.55-0.60 is the published benchmark for international
            football. FiveThirtyEight's SPI sits in that range, top Kaggle competition entries do
            too, and bookmaker markets settle there. Our 0.57-0.58 is calibrated against the same
            standard.
          </p>
          <p>
            The model's biggest misses are the famous WC upsets: <strong>Argentina 1-1 Iceland</strong>{" "}
            (2018), <strong>South Korea 2-0 Germany</strong> (2018), <strong>Argentina 1-2 Saudi
            Arabia</strong> (2022), <strong>Cameroon 1-0 Brazil</strong> (2022). Bookmakers got
            those wrong too. Tournament football has irreducible variance.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data sources</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>49,256 international match results</strong> 1872 → 2026-03-31 from{" "}
              <a
                href="https://github.com/martj42/international_results"
                className="underline hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                martj42/international_results
              </a>
              . <strong>30,997 of these (1990 →)</strong> are used in the actual fit, covering the
              48 qualified teams plus all 176 of their direct opponents (the 1-hop neighbourhood).
              Including the wider universe lets transitive evidence inform the qualified teams' strength.
            </li>
            <li>
              <strong>Per-goal records</strong> with scorer, minute, penalty/own-goal flags from the
              same repo's <code className="text-xs">goalscorers.csv</code>, used by the{" "}
              <Link href="/golden-boot" className="underline">Golden Boot</Link> module.
            </li>
            <li>
              <strong>Live Elo ratings</strong> from{" "}
              <a href="https://www.eloratings.net/" className="underline hover:text-foreground">
                eloratings.net
              </a>{" "}
              for all 48 qualified teams, scraped from the public TSV endpoint.
            </li>
            <li>
              <strong>EA FC 25 player ratings</strong> for 18,205 footballers from Kaggle{" "}
              <code className="text-xs">aniss7/fifa-player-data-from-sofifa-2025-06-03</code>,
              aggregated to top-23 mean overall per nation.
            </li>
            <li>
              <strong>Official FIFA Final Draw</strong> (5 December 2025, Washington DC). The 12
              groups of 4 are hardcoded in{" "}
              <code className="text-xs">src/wc2026/draw.py</code>.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roadmap: improvements shipped &amp; pending</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px]">
              Shipped
            </Badge>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Sum to zero priors</strong> on att/def. Fixes identifiability between
                team effects and intercept. Brier −0.003 on 2018, +3pp accuracy on 2022.
              </li>
              <li>
                <strong>Wider training universe (1 hop neighbourhood)</strong>. Fit now uses{" "}
                <span className="font-mono font-semibold">30,997 matches</span> across{" "}
                <span className="font-mono font-semibold">224 teams</span> instead of just the 4,226
                between qualified teams. Major posterior shifts: Brazil rose from 9.7% to 13.7%
                champion probability, Argentina took #1 (16.7%), and France's prior-driven 12.9%
                came down to 6.9% as recent on-field results carry more weight.
              </li>
              <li>
                <strong>Probabilistic Golden Boot</strong> via 20k Monte Carlo sims of per-player
                Poisson goal draws. Gives P(wins Golden Boot) per player rather than a point
                estimate. Top 3: Haaland 14.1%, Kane 13.9%, Mbappé 9.9%.
              </li>
              <li>
                <strong>FC 25 ↔ historical scorer blending</strong>. Dirichlet Multinomial conjugate
                update floors emerging stars (Yamal, Wirtz) with attacking-attribute priors so
                they're not penalized for short international scoring history.
              </li>
            </ul>
          </div>

          <div>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px]">
              Just shipped
            </Badge>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Cross-validated time-decay half-life</strong>. Swept{" "}
                <span className="font-mono">[1.0, 1.5, 2.0, 2.5, 3.0, 4.0]</span>-year half-lives
                on 2018 + 2022 back-tests. <strong>4.0y wins</strong> (avg Brier 0.5745) but
                2.5y was nearly identical (0.5748); the model is robust in the 2.5-4.0y range.
                Production default bumped to 4.0y. Going below 2.0y costs ~0.01-0.02 Brier.
              </li>
              <li>
                <strong>Per-team home advantage</strong> as a hierarchical Normal:{" "}
                γ<sub>i</sub> ~ Normal(γ<sub>μ</sub>, σ<sub>γ</sub>) instead of a single global γ.
                Empirical data (Kneafsey &amp; Mueller 2017) shows the home bonus ranges 0.2 to 0.5
                log-goals across nations. The model now extracts that variance from training data.
              </li>
              <li>
                <strong>Confederation-level shrinkage priors</strong>. Each team's att/def now
                shrinks toward its confederation mean (UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC) on
                top of the global ZeroSumNormal prior. Sparse-data teams (Curaçao, Cape Verde) are
                pulled toward their continental baseline rather than a global mean — and the
                top-end gets compressed: <strong>Spain 14.7%</strong>, Brazil 14.7%, Argentina
                12.9% on the latest run, the closest to the bookmaker market we've had.
              </li>
            </ul>
          </div>

          <div>
            <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/40 text-[10px]">
              Next
            </Badge>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Squad list updates</strong>. When 26 man rosters drop ~2026-06-01, recompute
                squad strength using only listed players (currently uses the broader player
                pool). Mbappé-out / Messi-out style sensitivity scenarios should be a one-flag flip.
              </li>
              <li>
                <strong>Ensemble with an XGBoost or neural-net challenger</strong>, blended via a
                constrained log-pool that minimizes back-test log-loss. Ensembling typically buys
                0.005-0.01 Brier in the football literature.
              </li>
              <li>
                <strong>StatsBomb xG events</strong> for matches where they exist (recent WCs,
                Euros, Women's WC). Per-shot data is much higher signal-per-match than the final
                score.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Code &amp; reproducibility</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>The whole pipeline is a handful of scripts. End-to-end reproduces in ~25 min on this server:</p>
          <Code>
{`python scripts/download_data.py    # martj42 + Elo + EA FC 25 + goalscorers (~1 min)
python scripts/train.py            # PyMC, 4 chains × 2k draws on 30k matches (~10 min)
python scripts/simulate.py         # 50,000 tournament rollouts (~6 min)
python scripts/compute_matchups.py # 2,256 pairwise probabilities (~2 min)
python scripts/golden_boot.py      # top-scorer expectations + P(Golden Boot)
python scripts/sweep_halflife.py   # cross-validate time-decay (optional)
python scripts/generate_eda.py     # 10 EDA charts
python scripts/generate_report.py  # PDF technical report`}
          </Code>
          <p>
            The Bayesian fit uses{" "}
            <a href="https://www.pymc.io" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
              PyMC
            </a>
            's NUTS sampler with 4 chains × 2,000 tune × 2,000 draws. Production fits get 0
            divergences with target_accept = 0.95.
          </p>
          <p>
            Every output JSON the frontend reads (
            <Link href="/results.json" className="underline">/results.json</Link>,{" "}
            <Link href="/matchups.json" className="underline">/matchups.json</Link>,{" "}
            <Link href="/team_meta.json" className="underline">/team_meta.json</Link>,{" "}
            <Link href="/golden_boot.json" className="underline">/golden_boot.json</Link>) is a
            symlink into the Python pipeline's <code className="text-xs">output/</code> directory,
            so re-running the pipeline immediately refreshes the dashboard.
          </p>
          <p>
            Full technical report:{" "}
            <Link href="/report.pdf" className="underline" target="_blank">
              report.pdf
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cite this work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            If you use this forecaster in a paper, post, or article, a link back is appreciated.
          </p>
          <CitationBlock text={CITATION} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1 text-muted-foreground">
          <p>
            Dixon, M. J. &amp; Coles, S. G. (1997). Modelling association football scores and
            inefficiencies in the football betting market. <em>Applied Statistics</em> 46(2),
            265-280.
          </p>
          <p>
            Baio, G. &amp; Blangiardo, M. (2010). Bayesian hierarchical model for the prediction of
            football results. <em>Journal of Applied Statistics</em> 37(2), 253-264.
          </p>
          <p>
            Kneafsey, M. &amp; Mueller, S. (2017). Neutral grounds in international football:
            tournament-by-tournament home advantage analysis.
          </p>
          <p>
            Berrar, D., Lopes, P. &amp; Dubitzky, W. (2019). Incorporating domain knowledge in
            machine learning for soccer outcome prediction. <em>Machine Learning</em> 108, 97-126.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
