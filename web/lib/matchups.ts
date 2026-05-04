import { promises as fs } from "fs";
import path from "path";

export type MatchupCell = {
  p_a: number;
  p_d: number;
  p_b: number;
  ea: number;
  eb: number;
  top_score: string;
};

export type Matchups = {
  teams: string[];
  matchups: Record<string, MatchupCell>;
  n_samples: number;
};

let cached: Matchups | null = null;

export async function getMatchups(): Promise<Matchups> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "matchups.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as Matchups;
  return cached;
}
