import { promises as fs } from "fs";
import path from "path";
import type { Results } from "./types";

export { pct, teamFlag, topN } from "./format";

let cached: Results | null = null;

export async function getResults(): Promise<Results> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "results.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as Results;
  return cached;
}
