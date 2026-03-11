export type StatKey =
  | "HP"
  | "ATK"
  | "DEF"
  | "HP%"
  | "ATK%"
  | "DEF%"
  | "ER"
  | "EM"
  | "CR"
  | "CD";

export interface Substat {
  stat: StatKey;
  value: number;
}

export interface ArtifactInput {
  rarity: 3 | 4 | 5;
  level: number;
  main_stat: StatKey;
  substats: Substat[];
}

export interface DistributionResponse {
  info?: string;
  next_artifact?: {
    level: number;
    states: Record<string, number>;
  };
  max_artifact?: {
    level: number;
    states: Record<string, number>;
  };
  next_event: { label: string; probability: number }[];
  max_level: { label: string; probability: number }[];
}

export interface ProbabilityUpgradeVectorResponse {
  probability: number;
  status?: string;
}

export interface ProbabilityThresholdResponse {
  probability: number;
}

export interface MonteCarloResponse {
  mean: Record<StatKey, number>;
  min: Record<StatKey, number>;
  max: Record<StatKey, number>;
  distribution: { stat: StatKey; value: number }[];
}

export interface MonteCarloTopKResponse {
  N: number;
  top_k: Array<{
    stats: Record<string, number>;
    probability: number;
    frequency: number;
  }>;
}

export type UtilityFunction = string;
export type UtilityTarget = "next" | "max";

export interface ExpectedUtilityResponse {
  error?: string;
  expected_utility: number;
  expected_gain?: number;
  variance?: number;
  risk_adjusted?: number;
  probability_positive?: number;
  probability_of_improvement?: number;
  current_utility?: number;
  recommendation?: string;
  interpretation?: string;
  breakdown?: Array<{ label: string; value: number }>;
}

export type RollValues = Record<3 | 4 | 5, Record<StatKey, number[]>>;
export type MaxSubstats = Record<3 | 4 | 5, Record<StatKey, number>>;
export type MaxUpgrades = Record<3 | 4 | 5, number>;
