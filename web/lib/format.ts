export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function teamFlag(team: string): string {
  const map: Record<string, string> = {
    "United States": "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽",
    Panama: "🇵🇦", Haiti: "🇭🇹", Curaçao: "🇨🇼",
    Argentina: "🇦🇷", Brazil: "🇧🇷", Uruguay: "🇺🇾", Colombia: "🇨🇴",
    Paraguay: "🇵🇾", Ecuador: "🇪🇨",
    France: "🇫🇷", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Spain: "🇪🇸", Germany: "🇩🇪",
    Portugal: "🇵🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪", Croatia: "🇭🇷",
    Switzerland: "🇨🇭", Austria: "🇦🇹", Norway: "🇳🇴", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    Sweden: "🇸🇪", Turkey: "🇹🇷", "Czech Republic": "🇨🇿",
    "Bosnia and Herzegovina": "🇧🇦",
    Morocco: "🇲🇦", Senegal: "🇸🇳", Egypt: "🇪🇬", Algeria: "🇩🇿",
    Tunisia: "🇹🇳", Ghana: "🇬🇭", "Ivory Coast": "🇨🇮", "Cape Verde": "🇨🇻",
    "South Africa": "🇿🇦", "DR Congo": "🇨🇩",
    Japan: "🇯🇵", "South Korea": "🇰🇷", Iran: "🇮🇷", Australia: "🇦🇺",
    "Saudi Arabia": "🇸🇦", Qatar: "🇶🇦", Jordan: "🇯🇴", Uzbekistan: "🇺🇿",
    Iraq: "🇮🇶", "New Zealand": "🇳🇿",
  };
  return map[team] ?? "🏳️";
}

export function topN<T>(map: Record<string, T>, n: number, scoreFn: (v: T) => number): [string, T][] {
  return Object.entries(map)
    .sort((a, b) => scoreFn(b[1]) - scoreFn(a[1]))
    .slice(0, n);
}
