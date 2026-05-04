import { ImageResponse } from "next/og";
import { getResults, pct, topN } from "@/lib/data";

export const alt = "WC 2026 Forecaster. Bayesian Monte Carlo simulation of the 2026 FIFA World Cup";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const r = await getResults();
  const top3 = topN(r.probabilities.champion, 3, (v) => v);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 50%, #064e3b 100%)",
          color: "white",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header: trophy + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="80" height="80" viewBox="0 0 512 512">
            <rect x="0" y="0" width="512" height="512" rx="96" fill="#020617" />
            <path
              d="M 168 152 C 110 152 88 196 88 232 C 88 274 124 296 168 300 L 168 268 C 142 264 124 250 124 230 C 124 208 142 188 168 188 Z"
              fill="#10b981"
            />
            <path
              d="M 344 152 C 402 152 424 196 424 232 C 424 274 388 296 344 300 L 344 268 C 370 264 388 250 388 230 C 388 208 370 188 344 188 Z"
              fill="#10b981"
            />
            <path
              d="M 168 120 L 344 120 L 344 224 C 344 304 312 360 256 360 C 200 360 168 304 168 224 Z"
              fill="#34d399"
            />
            <rect x="232" y="360" width="48" height="36" fill="#10b981" />
            <rect x="184" y="396" width="144" height="22" rx="4" fill="#10b981" />
            <rect x="148" y="418" width="216" height="34" rx="8" fill="#34d399" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1.5 }}>
              WC 2026 Forecaster
            </div>
            <div style={{ fontSize: 22, color: "#94a3b8", marginTop: 4 }}>
              {`Bayesian Monte Carlo · ${r.n_simulations.toLocaleString()} simulated tournaments`}
            </div>
          </div>
        </div>

        {/* Title question */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.05,
            marginTop: 48,
            letterSpacing: -2,
          }}
        >
          Who lifts the trophy
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#34d399",
          }}
        >
          in 2026?
        </div>

        {/* Podium */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: "auto",
          }}
        >
          {top3.map(([team, p], i) => {
            const tones = [
              { ring: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", medal: "1st" },
              { ring: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", medal: "2nd" },
              { ring: "#fb923c", bg: "rgba(251, 146, 60, 0.15)", medal: "3rd" },
            ];
            const t = tones[i];
            return (
              <div
                key={team}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  background: t.bg,
                  border: `2px solid ${t.ring}`,
                  borderRadius: 16,
                  padding: "20px 24px",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: t.ring,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {t.medal}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>
                  {team}
                </div>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 4,
                  }}
                >
                  {pct(p, 1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
