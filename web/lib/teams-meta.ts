export type TeamMeta = {
  confederation: "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
  host: boolean;
  group: string | null;
  elo: number | null;
  elo_rank: number;
  squad_strength: number | null;
  squad_top11: number | null;
  squad_n: number | null;
};

export type TeamMetas = Record<string, TeamMeta>;

export const CONFEDERATION_NAMES: Record<TeamMeta["confederation"], string> = {
  UEFA: "Europe (UEFA)",
  CONMEBOL: "South America (CONMEBOL)",
  CONCACAF: "North America (CONCACAF)",
  CAF: "Africa (CAF)",
  AFC: "Asia (AFC)",
  OFC: "Oceania (OFC)",
};
