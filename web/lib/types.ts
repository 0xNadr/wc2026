export type ProbabilityMap = Record<string, number>;

export type StageProbabilities = {
  champion: ProbabilityMap;
  final: ProbabilityMap;
  semifinal: ProbabilityMap;
  quarterfinal: ProbabilityMap;
  round_of_16: ProbabilityMap;
  round_of_32: ProbabilityMap;
  group_winner: ProbabilityMap;
  group_runner_up: ProbabilityMap;
  group_third_advancing: ProbabilityMap;
  group_eliminated: ProbabilityMap;
};

export type AlternateReality = {
  champion: string;
  runner_up: string;
  semifinalists: string[];
  quarterfinalists: string[];
  groups: Record<string, string[]>;
};

export type Results = {
  n_simulations: number;
  teams: string[];
  probabilities: StageProbabilities;
  groups: Record<string, string[]>;
  alternate_realities: AlternateReality[];
};

export const STAGES = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
  "champion",
] as const satisfies readonly (keyof StageProbabilities)[];

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  round_of_32: "R32",
  round_of_16: "R16",
  quarterfinal: "QF",
  semifinal: "SF",
  final: "Final",
  champion: "Champion",
};
