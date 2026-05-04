import { promises as fs } from "fs";
import path from "path";

export type Player = {
  name: string;
  full_name: string | null;
  position: string | null;
  overall: number | null;
  potential: number | null;
  age: number | null;
  height: number | null;
  club: string | null;
  club_league: string | null;
  foot: string | null;
  value: string | null;
  wage: string | null;
  image: string | null;
};

export type Squads = Record<string, Player[]>;

let cached: Squads | null = null;

export async function getSquads(): Promise<Squads> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "squads.json");
  const raw = await fs.readFile(file, "utf-8");
  cached = JSON.parse(raw) as Squads;
  return cached;
}
