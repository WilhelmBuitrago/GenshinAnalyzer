import axios from "axios";
import type {
  ArtifactInput,
  ExpectedUtilityResponse,
  MonteCarloResponse,
  MonteCarloTopKResponse,
  ProbabilityUpgradeVectorResponse,
  DistributionResponse,
  RollValues,
  MaxSubstats,
  MaxUpgrades
} from "@/types/artifact";

type ThresholdPayload = { stat: string; value: number };

type ExpectedUtilityPayload = {
  artifact: ArtifactInput;
  utility_function: string;
  risk_lambda: number;
  mc_samples: number;
  to: "next" | "max";
};

type BackendArtifactPayload = {
  rarity: number;
  level: number;
  main_stat: string;
  substats: Record<string, number>;
};

const toBackendArtifact = (artifact: ArtifactInput): BackendArtifactPayload => {
  const substats = artifact.substats.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.stat] = entry.value;
    return acc;
  }, {});

  return {
    rarity: artifact.rarity,
    level: artifact.level,
    main_stat: artifact.main_stat,
    substats,
  };
};

const toThresholdDict = (thresholds: ThresholdPayload[]): Record<string, number> => {
  return thresholds.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.stat] = entry.value;
    return acc;
  }, {});
};

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 20_000
});

export async function runDistributionEvents(artifact: ArtifactInput): Promise<DistributionResponse> {
  const { data } = await api.post<DistributionResponse>("/distribution-events", toBackendArtifact(artifact));
  return data;
}

export async function runProbabilityUpgradeVector(payload: {
  artifact: ArtifactInput;
  vector: number[];
}): Promise<ProbabilityUpgradeVectorResponse> {
  const { data } = await api.post<ProbabilityUpgradeVectorResponse>("/probability-upgrade-vector", {
    artifact: toBackendArtifact(payload.artifact),
    upgrade_counts: payload.vector,
  });
  return data;
}

export async function runProbabilityThreshold(payload: {
  artifact: ArtifactInput;
  thresholds: ThresholdPayload[];
}): Promise<number> {
  const { data } = await api.post<number>("/probability-threshold", {
    artifact: toBackendArtifact(payload.artifact),
    thresholds: toThresholdDict(payload.thresholds),
  });
  return data;
}

export async function runMonteCarlo(payload: {
  artifact: ArtifactInput;
  simulations: number;
}): Promise<MonteCarloResponse> {
  console.log("Running Monte Carlo with payload:", payload);
  const { data } = await api.post<MonteCarloResponse>("/monte-carlo", {
    artifact: toBackendArtifact(payload.artifact),
    simulations: payload.simulations,
  });
  return data;
}

export async function runMonteCarloTopK(payload: {
  artifact: ArtifactInput;
  simulations: number;
  k: number;
}): Promise<MonteCarloTopKResponse> {
  const { data } = await api.post<MonteCarloTopKResponse>("/monte-carlo-top-k", {
    artifact: toBackendArtifact(payload.artifact),
    simulations: payload.simulations,
    k: payload.k,
  });
  return data;
}

export async function runExpectedUtility(payload: ExpectedUtilityPayload): Promise<ExpectedUtilityResponse> {
  console.log("Running expected utility with payload:", payload);
  console.log("Converted artifact for backend:", toBackendArtifact(payload.artifact));
  const { data } = await api.post<ExpectedUtilityResponse>("/expected-utility", {
    artifact: toBackendArtifact(payload.artifact),
    utility_function: payload.utility_function,
    risk_lambda: payload.risk_lambda,
    mc_samples: payload.mc_samples,
    to: payload.to,
  });
  return data;
}

export async function fetchUtilityFunctions(): Promise<string[]> {
  const { data } = await api.get<string[]>("/utility_functions");
  return data;
}

export async function fetchRollValues(): Promise<RollValues> {
  const { data } = await api.get<RollValues>("/roll_values");
  return data;
}

export async function fetchMaxSubstats(): Promise<MaxSubstats> {
  const { data } = await api.get<MaxSubstats>("/max_substats");
  return data;
}

export async function fetchMaxUpdateValues(): Promise<MaxUpgrades> {
  const { data } = await api.get<MaxUpgrades>("/max_update_values");
  return data;
}

export { api };
