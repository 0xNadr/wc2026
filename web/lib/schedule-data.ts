import { promises as fs } from "fs";
import path from "path";
import type { Schedule } from "./schedule";

let cached: Schedule | null = null;

export async function getSchedule(): Promise<Schedule> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "schedule.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as Schedule;
  return cached;
}
