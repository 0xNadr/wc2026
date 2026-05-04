import { promises as fs } from "fs";
import path from "path";
import type { TeamMetas } from "./teams-meta";

export type { TeamMeta, TeamMetas } from "./teams-meta";
export { CONFEDERATION_NAMES } from "./teams-meta";

let cached: TeamMetas | null = null;

export async function getTeamMetas(): Promise<TeamMetas> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "team_meta.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as TeamMetas;
  return cached;
}
