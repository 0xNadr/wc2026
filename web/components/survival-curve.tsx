type Point = { stage: string; label: string; p: number };

export function SurvivalCurve({ survival }: { survival: Point[] }) {
  const W = 600;
  const H = 200;
  const padL = 32;
  const padR = 36;
  const padT = 18;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const n = survival.length;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * innerW;
  const y = (p: number) => padT + (1 - p) * innerH;

  // Build smooth-ish polyline using catmull-rom-ish bezier
  const points = survival.map((s, i) => [x(i), y(s.p)] as const);

  // Path with cubic bezier between points for a smooth feel
  const linePath = (() => {
    if (points.length === 0) return "";
    const path = [`M ${points[0][0]} ${points[0][1]}`];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cx = (x0 + x1) / 2;
      path.push(`C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`);
    }
    return path.join(" ");
  })();

  const areaPath =
    linePath +
    ` L ${points[points.length - 1][0]} ${padT + innerH}` +
    ` L ${points[0][0]} ${padT + innerH} Z`;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={padT + (1 - g) * innerH}
            y2={padT + (1 - g) * innerH}
            stroke="currentColor"
            className="text-border/40"
            strokeDasharray="2 4"
          />
        ))}
        {/* Area under curve */}
        <defs>
          <linearGradient id="survival-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#survival-grad)" />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots + value labels */}
        {survival.map((s, i) => {
          const [cx, cy] = points[i];
          return (
            <g key={s.stage}>
              <circle cx={cx} cy={cy} r="5" fill="rgb(16 185 129)" />
              <circle cx={cx} cy={cy} r="2" fill="white" />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                className="fill-foreground font-mono tabular-nums"
                fontSize="11"
                fontWeight="600"
              >
                {(s.p * 100).toFixed(s.p < 0.1 ? 1 : 0)}%
              </text>
            </g>
          );
        })}
        {/* X axis labels */}
        {survival.map((s, i) => (
          <text
            key={s.stage}
            x={x(i)}
            y={H - 18}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            {s.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
