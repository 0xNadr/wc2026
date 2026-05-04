import { promises as fs } from "fs";
import path from "path";

export type GoldenBootEntry = {
  rank: number;
  scorer: string;
  team: string;
  blended_share: number;
  hist_share: number;
  fc25_share: number;
  expected_team_goals: number;
  expected_player_goals: number;
  n_recent_goals: number;
};

let cached: GoldenBootEntry[] | null = null;

export async function getGoldenBoot(): Promise<GoldenBootEntry[]> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "golden_boot.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as GoldenBootEntry[];
  return cached;
}
