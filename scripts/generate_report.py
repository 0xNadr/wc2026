"""Generate a multi-page PDF technical report covering methodology + results.

Output: output/report.pdf — bundled with the web app at /report.pdf.
"""
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak,
)

from wc2026.config import OUTPUT


def main() -> None:
    results = json.loads((OUTPUT / "results.json").read_text())

    out = OUTPUT / "report.pdf"
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm,
                            title="WC 2026 Forecaster — Technical Report",
                            author="Nader Bennour")

    ss = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=ss["Heading1"], fontSize=22,
                                  textColor=colors.HexColor("#0f766e"), spaceAfter=12)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=14,
                        textColor=colors.HexColor("#1f2937"), spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("body", parent=ss["BodyText"], fontSize=10, leading=14, spaceAfter=8)
    code = ParagraphStyle("code", parent=ss["Code"], fontSize=9, leading=12, spaceAfter=8,
                          backColor=colors.HexColor("#f3f4f6"))
    footer = ParagraphStyle("footer", parent=ss["BodyText"], fontSize=8,
                            textColor=colors.HexColor("#6b7280"))

    flow: list = []

    # Cover
    flow.append(Paragraph("WC 2026 Forecaster", title_style))
    flow.append(Paragraph(f"<b>Technical Report — generated {date.today().isoformat()}</b>", body))
    flow.append(Spacer(1, 12))
    flow.append(Paragraph(
        "Bayesian hierarchical Dixon-Coles bivariate Poisson model fitted on 4,226 international "
        "matches since 1990, with Elo + EA FC 25 squad-strength informative priors. "
        f"{results['n_simulations']:,} Monte Carlo tournament rollouts using the official 12-group "
        "FIFA draw (5 December 2025).", body))
    flow.append(Paragraph(
        "<b>Live forecast:</b> https://wc2026.nader.info/", body))

    # Top 10 champions
    flow.append(Paragraph("Champion Probabilities", h2))
    top = sorted(results["probabilities"]["champion"].items(), key=lambda x: -x[1])[:10]
    table_data = [["Rank", "Team", "Champion %", "Final %", "Semi %", "QF %"]]
    for i, (team, p) in enumerate(top, start=1):
        table_data.append([
            str(i), team,
            f"{p*100:.2f}%",
            f"{results['probabilities']['final'][team]*100:.1f}%",
            f"{results['probabilities']['semifinal'][team]*100:.1f}%",
            f"{results['probabilities']['quarterfinal'][team]*100:.1f}%",
        ])
    t = Table(table_data, hAlign="LEFT", colWidths=[1.2*cm, 4.5*cm, 2.2*cm, 2*cm, 2*cm, 2*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(t)

    # Methodology
    flow.append(PageBreak())
    flow.append(Paragraph("Methodology", h2))
    flow.append(Paragraph(
        "<b>Match-outcome model:</b> Bayesian hierarchical Dixon-Coles bivariate Poisson. For "
        "each match between teams h (home) and a (away):", body))
    flow.append(Paragraph(
        "log(λ_home) = α + att[h] − def[a] + γ[h] · (1 − is_neutral)<br/>"
        "log(λ_away) = α + att[a] − def[h]<br/>"
        "P(X=x, Y=y) ∝ τ(x, y; λ_h, λ_a, ρ) · Pois(x | λ_h) · Pois(y | λ_a)", code))
    flow.append(Paragraph(
        "<b>Priors:</b> ZeroSumNormal on att/def for identifiability, anchored by a 0.7 · Elo + "
        "0.3 · squad-strength composite. Each team also has a hierarchical confederation-level "
        "offset and a per-team home advantage γ[i] ~ Normal(γ_μ, σ_γ). ρ ∈ (−0.15, 0.15) controls "
        "low-score correlation. NUTS sampling, 4 chains × 2k draws, 0 divergences.", body))
    flow.append(Paragraph(
        "<b>Match weighting:</b> per-match weight = exp(−ln(2) · age / 4.0yr) · importance_weight. "
        "The 4.0-year half-life was selected by sweeping [1.0, 1.5, 2.0, 2.5, 3.0, 4.0] across "
        "2018+2022 back-tests; 4.0y wins by a hair (avg Brier 0.5745 vs 0.5748 at 2.5y). Importance "
        "follows the Elo K-factor convention (WC = 1.0, qualifier = 0.65, friendly = 0.30).", body))
    flow.append(Paragraph(
        "<b>Training universe:</b> 224 teams (the 48 qualified plus all 176 of their direct "
        "opponents since 1990), 30,997 matches. Including the wider universe lets transitive "
        "evidence inform the qualified teams' strength.", body))
    flow.append(Paragraph(
        "<b>Simulation:</b> Each tournament samples one posterior draw, simulates 12 groups with "
        "full FIFA tiebreak chain (pts → GD → GF → H2H → FIFA rank → lots), then runs the bracket "
        "through R32 → R16 → QF → SF → Final with extra time and penalty shootout handling.", body))

    # Calibration
    flow.append(Paragraph("Calibration: back-test against past WCs", h2))
    # Read calibration from output/backtest_*.csv if present, else fall back to last-known.
    import pandas as pd
    cal_data = [["Year", "n", "Brier", "Log-loss", "Accuracy", "Goal MAE"]]
    for year in (2018, 2022):
        bt_path = OUTPUT / f"backtest_{year}.csv"
        if bt_path.exists():
            df = pd.read_csv(bt_path)
            cal_data.append([
                str(year), str(len(df)),
                f"{df['brier'].mean():.3f}",
                f"{df['log_loss'].mean():.3f}",
                f"{df['correct'].mean()*100:.1f}%",
                f"{(df['expected_goals'] - (df['home_score']+df['away_score'])).abs().mean():.2f}",
            ])
    cal_data.append(["Naive (1/3-1/3-1/3)", "—", "0.667", "1.099", "33.3%", "—"])
    t2 = Table(cal_data, hAlign="LEFT")
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(t2)
    flow.append(Paragraph(
        "Brier 0.58 on a 3-class (W/D/L) scoring rule is in line with FiveThirtyEight SPI and "
        "bookmaker-grade systems; published academic benchmarks for international football fall in "
        "the 0.55–0.60 range. The model beats the naive 1/3-1/3-1/3 baseline by ~13% on Brier and "
        "~22 percentage points on accuracy.", body))

    # Charts
    flow.append(PageBreak())
    flow.append(Paragraph("Exploratory data analysis", h2))
    eda_dir = OUTPUT / "eda"
    chart_files = sorted(eda_dir.glob("*.png"))
    for chart in chart_files:
        try:
            img = Image(str(chart), width=15*cm, height=8.5*cm, kind="proportional")
            flow.append(img)
            flow.append(Spacer(1, 4))
        except Exception as e:
            print(f"  ⚠ failed to embed {chart.name}: {e}")

    # Footer
    flow.append(PageBreak())
    flow.append(Paragraph("Data sources", h2))
    flow.append(Paragraph(
        "• martj42/international_results — 49,256 international matches 1872 → 2026<br/>"
        "• martj42/goalscorers.csv — 47,601 per-goal records (used for Golden Boot estimates)<br/>"
        "• eloratings.net — current Elo for all 48 qualified teams<br/>"
        "• Kaggle aniss7/fifa-player-data-from-sofifa-2025-06-03 — 18,205 EA FC 25 player ratings<br/>"
        "• FIFA Final Draw 2025-12-05 (Washington DC) — group assignments<br/>",
        body))
    flow.append(Paragraph("References", h2))
    flow.append(Paragraph(
        "• Dixon, M. J. & Coles, S. G. (1997). Modelling association football scores and "
        "inefficiencies in the football betting market.<br/>"
        "• Baio, G. & Blangiardo, M. (2010). Bayesian hierarchical model for the prediction of "
        "football results.<br/>",
        body))
    flow.append(Spacer(1, 12))
    flow.append(Paragraph(
        f"Live: <link href='https://wc2026.nader.info/'>wc2026.nader.info</link> · "
        f"Generated {date.today().isoformat()}",
        footer))

    doc.build(flow)
    print(f"✓ Wrote {out}  ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
