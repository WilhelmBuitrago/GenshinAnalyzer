"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ArtifactInput, MaxSubstats, MaxUpgrades, RollValues, StatKey } from "@/types/artifact";
import {
  runDistributionEvents,
  runProbabilityThreshold,
  runProbabilityUpgradeVector,
  runMonteCarlo,
  runMonteCarloTopK,
  runExpectedUtility,
  fetchUtilityFunctions,
  fetchRollValues,
  fetchMaxSubstats,
  fetchMaxUpdateValues,
} from "@/services/api";

type Rarity = 3 | 4 | 5;
type Mode = "distribution" | "upgrade_vector" | "threshold" | "monte_carlo" | "monte_carlo_top_k" | "expected_utility";
type Threshold = { stat: StatKey; value: number };

type ModeOption = {
  value: Mode;
  label: string;
  tooltip: string;
};

type DistributionModeResult = {
  info?: string;
  next_artifact?: { level: number; states: Record<string, number> };
  max_artifact?: { level: number; states: Record<string, number> };
};

type UpgradeVectorModeResult = {
  probability: number;
  status?: string;
};

type MonteCarloModeResult = Record<
  string,
  {
    mean: number;
    max: number;
    min: number;
    values: number[];
  }
>;

type MonteCarloTopKModeResult = {
  N: number;
  top_k: Array<{
    stats: Record<string, number>;
    probability: number;
    frequency: number;
  }>;
};

type ExpectedUtilityModeResult = {
  error?: string;
  expected_utility?: number;
  expected_gain?: number;
  variance?: number;
  risk_adjusted?: number;
  probability_positive?: number;
  probability_of_improvement?: number;
  current_utility?: number;
  recommendation?: string;
};

type ModeResult =
  | { mode: "distribution"; data: DistributionModeResult }
  | { mode: "upgrade_vector"; data: UpgradeVectorModeResult }
  | { mode: "threshold"; data: number }
  | { mode: "monte_carlo"; data: MonteCarloModeResult }
  | { mode: "monte_carlo_top_k"; data: MonteCarloTopKModeResult }
  | { mode: "expected_utility"; data: ExpectedUtilityModeResult };

const STAT_OPTIONS: StatKey[] = ["HP", "ATK", "DEF", "HP%", "ATK%", "DEF%", "ER", "EM", "CR", "CD"];

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "distribution",
    label: "Distribution events",
    tooltip: "Muestra la probabilidad del siguiente evento y del estado al nivel maximo. Ayuda a anticipar stats dominantes.",
  },
  {
    value: "upgrade_vector",
    label: "Probability upgrade vector",
    tooltip: "Calcula la probabilidad exacta de un vector de upgrades. Ideal para escenarios muy especificos.",
  },
  {
    value: "threshold",
    label: "Probability threshold",
    tooltip: "Estima la probabilidad de superar umbrales por stat. Util para objetivos minimos.",
  },
  {
    value: "monte_carlo",
    label: "Monte Carlo",
    tooltip: "Simula N resultados para estimar medias, minimos y maximos. Bueno para perspectiva global.",
  },
  {
    value: "monte_carlo_top_k",
    label: "Monte Carlo Top K",
    tooltip: "Devuelve las combinaciones finales mas probables tras N simulaciones. Resume los outcomes mas frecuentes.",
  },
  {
    value: "expected_utility",
    label: "Expected utility",
    tooltip: "Aplica una funcion de utilidad y riesgo para recomendar continuar o detener. Enfocado en decision.",
  },
];

const UPGRADE_LEVELS: Record<Rarity, number[]> = {
  3: [4, 8, 12],
  4: [4, 8, 12, 16],
  5: [4, 8, 12, 16, 20],
};

export default function Page() {
  const [artifact, setArtifact] = useState<ArtifactInput>({
    rarity: 5,
    level: 0,
    main_stat: "ATK%",
    substats: [],
  });
  const [mode, setMode] = useState<Mode>("distribution");
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [upgradeVector, setUpgradeVector] = useState<string>("1,1,1,1");
  const [simulations, setSimulations] = useState<number>(1000);
  const [topK, setTopK] = useState<number>(5);
  const [utilityFunction, setUtilityFunction] = useState<string>("");
  const [riskLambda, setRiskLambda] = useState<number>(0.5);
  const [utilitySamples, setUtilitySamples] = useState<number>(100);
  const [utilityTarget, setUtilityTarget] = useState<"next" | "max">("next");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rollValues, setRollValues] = useState<RollValues | null>(null);
  const [maxSubstats, setMaxSubstats] = useState<MaxSubstats | null>(null);
  const [maxUpgrades, setMaxUpgrades] = useState<MaxUpgrades | null>(null);
  const [utilityOptions, setUtilityOptions] = useState<string[]>([]);
  const [result, setResult] = useState<ModeResult | null>(null);

  useEffect(() => {
    const preload = async () => {
      try {
        const [utils, rolls, maxes, maxUps] = await Promise.all([
          fetchUtilityFunctions(),
          fetchRollValues(),
          fetchMaxSubstats(),
          fetchMaxUpdateValues(),
        ]);
        if (utils && utils.length > 0) {
          setUtilityOptions(utils);
          setUtilityFunction((prev) => (prev ? prev : utils[0]));
        }
        setRollValues(rolls);
        setMaxSubstats(maxes);
        setMaxUpgrades(maxUps);
      } catch (err) {
        console.warn("No se pudieron precargar utilidades o tablas", err);
      }
    };
    preload();
  }, []);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (mode === "threshold") return thresholds.length > 0;
    return true;
  }, [loading, mode, thresholds.length]);

  useEffect(() => {
    if (!rollValues || !maxSubstats) return;
    setArtifact((prev) => {
      const allowedLevelMax = maxLevelForRarity(prev.rarity);
      const clampedLevel = Math.min(prev.level, allowedLevelMax);

      const normalized = prev.substats.map((s) => {
        const snapped = snapToAllowed(s.stat, s.value, prev.rarity, clampedLevel);
        return snapped === s.value ? s : { ...s, value: snapped };
      });

      const sameLevel = clampedLevel === prev.level;
      const sameSubs = normalized.length === prev.substats.length && normalized.every((s, i) => s.stat === prev.substats[i].stat && s.value === prev.substats[i].value);
      if (sameLevel && sameSubs) return prev;
      return { ...prev, level: clampedLevel, substats: normalized };
    });
  }, [artifact.rarity, artifact.level, rollValues, maxSubstats]);

  const maxLevelForRarity = (rarity: Rarity) => Math.max(...UPGRADE_LEVELS[rarity]);

  const maxRollsForLevel = (rarity: Rarity, level: number) => {
    return UPGRADE_LEVELS[rarity].filter((l: number) => level >= l).length;
  };

  const getMaxForStat = (stat: StatKey, rarity = artifact.rarity) => maxSubstats?.[rarity]?.[stat] ?? 100;

  const getRolls = (stat: StatKey, rarity = artifact.rarity) => rollValues?.[rarity]?.[stat] ?? [];

  const round2 = (v: number) => Number(v.toFixed(2));
  const toCents = (v: number) => Math.round(v * 100);
  const fromCents = (v: number) => Number((v / 100).toFixed(2));

  const buildDiscreteValues = (rolls: number[], maxRolls: number) => {
    const max = Math.max(1, Math.floor(maxRolls));
    const rollsCents = Array.from(new Set(rolls.map((r) => toCents(round2(r))))).sort((a, b) => a - b);
    const allCents = new Set<number>();

    if (rollsCents.length === 0) {
      return [];
    }

    const enumerateForCount = (count: number, startIndex: number, sumCents: number) => {
      if (count === 0) {
        allCents.add(sumCents);
        return;
      }

      for (let i = startIndex; i < rollsCents.length; i++) {
        enumerateForCount(count - 1, i, sumCents + rollsCents[i]);
      }
    };

    for (let count = 1; count <= max; count++) {
      enumerateForCount(count, 0, 0);
    }

    return Array.from(allCents)
      .map(fromCents)
      .sort((a, b) => a - b);
  };

  const allowedValuesFor = (stat: StatKey, rarity: Rarity, level: number) => {
    const rolls = getRolls(stat, rarity);
    const effectiveMaxRolls = maxUpgrades?.[rarity] ?? Math.max(1, maxRollsForLevel(rarity, level));
    return buildDiscreteValues(rolls, effectiveMaxRolls);
  };

  const snapToAllowed = (stat: StatKey, target: number, rarity: Rarity, level: number) => {
    const allowed = allowedValuesFor(stat, rarity, level);
    if (allowed.length === 0) return target;
    let best = allowed[0];
    let bestDiff = Math.abs(target - best);
    for (const v of allowed) {
      const diff = Math.abs(target - v);
      if (diff < bestDiff) {
        best = v;
        bestDiff = diff;
      }
    }
    return best;
  };

  const updateSubstat = (index: number, field: "stat" | "value", value: StatKey | number) => {
    const next = artifact.substats.map((s, i) => {
      if (i !== index) return s;
      if (field === "stat") {
        const minAllowed = allowedValuesFor(value as StatKey, artifact.rarity, artifact.level)[0] ?? 0;
        return { stat: value as StatKey, value: minAllowed };
      }
      const snapped = snapToAllowed(s.stat, Number(value), artifact.rarity, artifact.level);
      return { ...s, value: Number(snapped.toFixed(2)) };
    });
    setArtifact({ ...artifact, substats: next });
  };

  const maxSubstatCount = 4;

  const addSubstat = () => {
    if (artifact.substats.length >= maxSubstatCount) return;
    const minAllowed = allowedValuesFor("HP", artifact.rarity, artifact.level)[0] ?? 0;
    setArtifact({ ...artifact, substats: [...artifact.substats, { stat: "HP", value: minAllowed }] });
  };

  const removeSubstat = (index: number) => {
    setArtifact({ ...artifact, substats: artifact.substats.filter((_, i) => i !== index) });
  };

  const updateThreshold = (index: number, field: "stat" | "value", value: StatKey | number) => {
    const next = thresholds.map((t, i) => (i === index ? { ...t, [field]: value } : t));
    setThresholds(next);
  };

  const addThreshold = () => {
    setThresholds([...thresholds, { stat: "HP", value: 0 }]);
  };

  const removeThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      switch (mode) {
        case "distribution": {
          const data = await runDistributionEvents(artifact);
          setResult({ mode: "distribution", data: data as DistributionModeResult });
          break;
        }
        case "upgrade_vector": {
          const vector = upgradeVector
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((v) => !Number.isNaN(v));
          const data = await runProbabilityUpgradeVector({ artifact, vector });
          setResult({ mode: "upgrade_vector", data: data as UpgradeVectorModeResult });
          break;
        }
        case "threshold": {
          const data = await runProbabilityThreshold({ artifact, thresholds });
          setResult({ mode: "threshold", data: data as number });
          break;
        }
        case "monte_carlo": {
          const data = await runMonteCarlo({ artifact, simulations });
          setResult({ mode: "monte_carlo", data: data as unknown as MonteCarloModeResult });
          break;
        }
        case "monte_carlo_top_k": {
          const data = await runMonteCarloTopK({ artifact, simulations, k: topK });
          setResult({ mode: "monte_carlo_top_k", data: data as MonteCarloTopKModeResult });
          break;
        }
        case "expected_utility": {
          const data = await runExpectedUtility({
            artifact,
            utility_function: utilityFunction,
            risk_lambda: riskLambda,
            mc_samples: utilitySamples,
            to: utilityTarget
          });
          setResult({ mode: "expected_utility", data: data as ExpectedUtilityModeResult });
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo completar la solicitud. Verifica el backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-4xl">
        <div className="card card-hover p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-muted">Genshin Analyzer</p>
              <h1 className="text-3xl md:text-4xl font-semibold text-text">Panel unificado</h1>
              <p className="text-sm text-muted mt-2 max-w-2xl">
                Configura un artefacto, elige modo de análisis y lanza la solicitud contra la API FastAPI. Todo en un solo cuadro central.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted bg-[#111119]">App Router · Dark Lab</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex flex-col gap-2 h-full">
              <label className="label">Rareza</label>
              <select
                className="input w-full"
                value={artifact.rarity}
                onChange={(e) => {
                  const rarity = Number(e.target.value) as ArtifactInput["rarity"];
                  const lvlMax = maxLevelForRarity(rarity);
                  setArtifact((prev) => ({
                    ...prev,
                    rarity,
                    level: Math.min(prev.level, lvlMax)
                  }));
                }}
              >
                {[3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    {r}⭐
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 h-full">
              <label className="label flex items-center justify-between">
                <span>Nivel</span>
                <span className="text-primary font-semibold">{artifact.level}</span>
              </label>
              <input
                type="range"
                min={0}
                max={maxLevelForRarity(artifact.rarity)}
                value={artifact.level}
                onChange={(e) => {
                  const lvl = Number(e.target.value);
                  setArtifact((prev) => ({ ...prev, level: lvl }));
                }}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex flex-col gap-2 h-full">
              <label className="label">Main stat</label>
              <select
                className="input w-full"
                value={artifact.main_stat}
                onChange={(e) => setArtifact({ ...artifact, main_stat: e.target.value as StatKey })}
              >
                {STAT_OPTIONS.map((s: StatKey) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Substats</p>
                <p className="text-xs text-muted">Agrega o elimina filas; los nombres usan las llaves de SUBSTAT_WEIGHTS.</p>
              </div>
              <button
                type="button"
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={addSubstat}
                disabled={artifact.substats.length >= maxSubstatCount}
              >
                {artifact.substats.length >= maxSubstatCount ? "Máximo alcanzado" : "+ Añadir substat"}
              </button>
            </div>
            <div className="space-y-2">
              {artifact.substats.length === 0 && (
                <div className="text-sm text-muted bg-white/5 rounded-xl p-3 border border-dashed border-white/10">
                  Sin substats. Añade al menos uno para enviar.
                </div>
              )}
              {artifact.substats.map((sub, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111119] border border-white/5 rounded-xl px-3 py-2">
                  {(() => {
                    const allowed = allowedValuesFor(sub.stat, artifact.rarity, artifact.level);
                    const minAllowed = allowed[0] ?? 0;
                    const maxAllowed = allowed[allowed.length - 1] ?? getMaxForStat(sub.stat);
                    const nearestIndex = (() => {
                      const exact = allowed.indexOf(round2(sub.value));
                      if (exact >= 0) return exact;
                      let bestIndex = 0;
                      let bestDiff = Number.POSITIVE_INFINITY;
                      for (let i = 0; i < allowed.length; i++) {
                        const diff = Math.abs(allowed[i] - sub.value);
                        if (diff < bestDiff) {
                          bestDiff = diff;
                          bestIndex = i;
                        }
                      }
                      return bestIndex;
                    })();

                    return (
                      <>
                  <div className="col-span-4 md:col-span-3">
                    <select
                      className="input w-full"
                      value={sub.stat}
                      onChange={(e) => updateSubstat(index, "stat", e.target.value as StatKey)}
                    >
                      {STAT_OPTIONS.map((s: StatKey) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                      <div className="col-span-6 md:col-span-7 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span>Valor</span>
                          <span className="text-sm text-primary font-semibold">
                            {sub.value.toFixed(2)} / {maxAllowed.toFixed(2)} ({allowed.length} valores)
                          </span>
                        </div>
                        <input
                          className="w-full accent-primary"
                          type="range"
                          min={0}
                          max={Math.max(allowed.length - 1, 0)}
                          step={1}
                          value={nearestIndex}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            const nextValue = allowed[idx] ?? minAllowed;
                            updateSubstat(index, "value", nextValue);
                          }}
                        />
                      </div>
                      </>
                    );
                  })()}
                  <div className="col-span-2 flex justify-end">
                    <button type="button" className="btn-secondary w-full" onClick={() => removeSubstat(index)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Modo</label>
              <select className="input w-full" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="label">Descripción rápida</label>
              <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-sm text-muted min-h-[52px]">
                {mode === "distribution" && "Devuelve distribución del siguiente evento y al nivel máximo."}
                {mode === "upgrade_vector" && "Evalúa probabilidad de un vector de upgrades específico."}
                {mode === "threshold" && "Calcula probabilidad de superar umbrales por stat."}
                {mode === "monte_carlo" && "Simula resultados agregados usando N corridas."}
                {mode === "monte_carlo_top_k" && "Devuelve las combinaciones finales más probables tras N simulaciones."}
                {mode === "expected_utility" && "Estimación de utilidad esperada con función elegida."}
              </div>
            </div>
          </div>

          {mode === "upgrade_vector" && (
            <div className="mt-4 space-y-2">
              <label className="label flex items-center gap-2">
                Vector de upgrades (separado por comas)
                <TooltipIcon text="Cada numero indica cuantos upgrades recibe cada substat. La suma debe coincidir con los upgrades restantes." />
              </label>
              <input
                className="input w-full"
                value={upgradeVector}
                onChange={(e) => setUpgradeVector(e.target.value)}
                placeholder="e.g., 2,2,1,1"
              />
            </div>
          )}

          {mode === "threshold" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="label flex items-center gap-2">
                  Umbrales por stat
                  <TooltipIcon text="Define valores minimos por stat. El resultado es la probabilidad de cumplirlos al maximo." />
                </label>
                <button type="button" className="btn-secondary" onClick={addThreshold}>
                  Añadir umbral
                </button>
              </div>
              <div className="space-y-2">
                {thresholds.map((t, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111119] border border-white/5 rounded-xl px-3 py-2">
                    <div className="col-span-5">
                      <select
                        className="input w-full"
                        value={t.stat}
                        onChange={(e) => updateThreshold(index, "stat", e.target.value as StatKey)}
                      >
                        {STAT_OPTIONS.map((s: StatKey) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input
                        className="input w-full"
                        type="number"
                        value={t.value}
                        onChange={(e) => updateThreshold(index, "value", Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button type="button" className="btn-secondary w-full" onClick={() => removeThreshold(index)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === "monte_carlo" && (
            <div className="mt-4 space-y-2">
              <label className="label flex items-center gap-2">
                Número de simulaciones
                <TooltipIcon text="A mayor N, mayor precision pero mas tiempo de calculo." />
              </label>
              <input
                className="input w-full"
                type="number"
                min={10}
                value={simulations}
                onChange={(e) => setSimulations(Number(e.target.value))}
              />
            </div>
          )}

          {mode === "monte_carlo_top_k" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  Número de simulaciones
                  <TooltipIcon text="Mas simulaciones mejoran la estabilidad del ranking Top K." />
                </label>
                <input
                  className="input w-full"
                  type="number"
                  min={10}
                  value={simulations}
                  onChange={(e) => setSimulations(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  Top K
                  <TooltipIcon text="Cuantas combinaciones finales mas probables quieres ver." />
                </label>
                <input
                  className="input w-full"
                  type="number"
                  min={1}
                  max={20}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {mode === "expected_utility" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  Utility function
                  <TooltipIcon text="Selecciona la funcion que traduce stats en utilidad. Cambia el criterio de decision." />
                </label>
                <select
                  className="input w-full"
                  value={utilityFunction}
                  onChange={(e) => setUtilityFunction(e.target.value)}
                >
                  {utilityOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  Risk λ
                  <TooltipIcon text="Aumenta la penalizacion por varianza. Valores altos hacen el modelo mas conservador." />
                </label>
                <input
                  className="input w-full"
                  type="number"
                  step={0.05}
                  value={riskLambda}
                  onChange={(e) => setRiskLambda(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  MC samples
                  <TooltipIcon text="Numero de muestras internas para estimar utilidad. Mas muestras = mas tiempo." />
                </label>
                <input
                  className="input w-full"
                  type="number"
                  min={50}
                  value={utilitySamples}
                  onChange={(e) => setUtilitySamples(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  Target
                  <TooltipIcon text="Define si la utilidad se calcula para el proximo upgrade o hasta el maximo." />
                </label>
                <select className="input w-full" value={utilityTarget} onChange={(e) => setUtilityTarget(e.target.value as "next" | "max")}>
                  <option value="next">next</option>
                  <option value="max">max</option>
                </select>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-muted">
              Modo activo: <span className="text-text font-semibold">{mode}</span>
            </div>
            <button
              type="button"
              className="btn-primary w-full md:w-auto disabled:opacity-60"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? "Procesando..." : "Enviar a API"}
            </button>
          </div>

          <div className="mt-6">
            <p className="label">Resultado</p>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-4 text-sm text-muted min-h-[140px]">
              {loading && <span className="animate-pulse text-primary">Cargando...</span>}
              {!loading && error && <span className="text-rose-400">{error}</span>}
              {!loading && !error && result && <ModeResultView result={result} />}
              {!loading && !error && !result && <span>Sin datos aún. Configura y envía para ver el resultado.</span>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ModeResultView({ result }: { result: ModeResult }) {
  if (result.mode === "distribution") {
    return <DistributionResultView data={result.data} />;
  }

  if (result.mode === "upgrade_vector") {
    const p = clampProbability(result.data.probability);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard title="Probabilidad" value={`${(p * 100).toFixed(2)}%`} />
          <MetricCard title="Vector válido" value={result.data.status === "OK" ? "Sí" : "Revisar"} />
          <MetricCard title="Estado" value={result.data.status ?? "Sin estado"} />
        </div>
        <ProbabilityBar value={p} />
      </div>
    );
  }

  if (result.mode === "threshold") {
    const p = clampProbability(result.data);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricCard title="Cumplir umbrales" value={`${(p * 100).toFixed(2)}%`} />
          <MetricCard title="Riesgo de no cumplir" value={`${((1 - p) * 100).toFixed(2)}%`} />
        </div>
        <ProbabilityBar value={p} />
      </div>
    );
  }

  if (result.mode === "monte_carlo") {
    const stats = Object.entries(result.data).map(([stat, values]) => ({
      stat,
      mean: values.mean,
      min: values.min,
      max: values.max,
      spread: values.max - values.min,
    }));

    if (stats.length === 0) {
      return <span>Sin datos de simulación.</span>;
    }

    return (
      <div className="space-y-4">
        <div className="h-64 rounded-xl border border-white/5 bg-surface/40 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="stat" stroke="#9CA3AF" tickLine={false} axisLine={false} />
              <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#1A1A23", border: "1px solid #2a2a36", borderRadius: 12 }}
                labelStyle={{ color: "#E5E7EB" }}
              />
              <Bar dataKey="mean" fill="#7C3AED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.map((entry) => (
            <div key={entry.stat} className="rounded-xl border border-white/5 bg-surface/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{entry.stat}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted">Min</p>
                  <p className="font-semibold text-text">{entry.min.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted">Media</p>
                  <p className="font-semibold text-text">{entry.mean.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted">Max</p>
                  <p className="font-semibold text-text">{entry.max.toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">Rango total: {entry.spread.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.mode === "monte_carlo_top_k") {
    const entries = result.data.top_k.map((item, index) => {
      const label = `#${index + 1}`;
      return {
        label,
        probability: item.probability,
        frequency: item.frequency,
        stats: item.stats,
      };
    });

    if (entries.length === 0) {
      return <span>Sin datos de simulacion.</span>;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard title="Simulaciones" value={String(result.data.N)} />
          <MetricCard title="Top K" value={String(entries.length)} />
          <MetricCard title="Max prob." value={`${(Math.max(...entries.map((e) => e.probability)) * 100).toFixed(2)}%`} />
        </div>

        <div className="h-64 rounded-xl border border-white/5 bg-surface/40 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={entries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
              <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                contentStyle={{ background: "#1A1A23", border: "1px solid #2a2a36", borderRadius: 12 }}
                labelStyle={{ color: "#E5E7EB" }}
                itemStyle={{ color: "#E5E7EB" }}
              />
              <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
                {entries.map((entry) => (
                  <Cell key={entry.label} fill={entry.probability > 0 ? "#7C3AED" : "#3F3F46"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entries.map((entry) => (
            <div key={entry.label} className="rounded-xl border border-white/5 bg-surface/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted">{entry.label}</p>
                <span className="text-xs text-primary font-semibold">{(entry.probability * 100).toFixed(2)}%</span>
              </div>
              <p className="mt-2 text-sm text-text">{formatStats(entry.stats)}</p>
              <p className="mt-2 text-xs text-muted">Frecuencia: {entry.frequency}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.data.error) {
    return <span className="text-rose-400">{result.data.error}</span>;
  }

  const expectedGain = result.data.expected_gain ?? 0;
  const riskAdjusted = result.data.risk_adjusted ?? 0;
  const variance = result.data.variance ?? 0;
  const pImprove = clampProbability(
    result.data.probability_of_improvement ?? result.data.probability_positive ?? 0
  );
  const recommendation = result.data.recommendation ?? "N/A";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard title="Ganancia esperada" value={expectedGain.toFixed(4)} />
        <MetricCard title="Ajustada por riesgo" value={riskAdjusted.toFixed(4)} />
        <MetricCard title="Varianza" value={variance.toFixed(4)} />
      </div>
      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-surface to-surface/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Recomendación del motor</p>
          <span className="rounded-full px-3 py-1 text-xs font-semibold bg-primary/20 text-primary">
            {recommendation}
          </span>
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted mb-1">Probabilidad de mejora</p>
          <ProbabilityBar value={pImprove} />
        </div>
      </div>
    </div>
  );
}

function DistributionResultView({ data }: { data: DistributionModeResult }) {
  if (data.info) {
    return <span>{data.info}</span>;
  }

  const nextRows = toDistributionRows(data.next_artifact?.states);
  const maxRows = toDistributionRows(data.max_artifact?.states);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCard title="Próximo nivel" value={String(data.next_artifact?.level ?? "—")} />
        <MetricCard title="Nivel máximo" value={String(data.max_artifact?.level ?? "—")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistributionChart title="Próximo evento" rows={nextRows} />
        <DistributionChart title="Estado al máximo" rows={maxRows} />
      </div>
    </div>
  );
}

function DistributionChart({ title, rows }: { title: string; rows: Array<{ stat: string; probability: number }> }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface/40 p-3">
        <p className="text-sm text-muted">{title}</p>
        <p className="mt-4 text-xs text-muted">Sin probabilidades para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-surface/40 p-3">
      <p className="text-sm text-muted mb-2">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
            <XAxis dataKey="stat" stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
              contentStyle={{ background: "#1A1A23", border: "1px solid #2a2a36", borderRadius: 12 }}
              labelStyle={{ color: "#E5E7EB" }}
              itemStyle={{ color: "#E5E7EB" }}
            />
            <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
              {rows.map((entry) => (
                <Cell key={entry.stat} fill={entry.probability > 0 ? "#7C3AED" : "#3F3F46"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </div>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  const width = `${(clampProbability(value) * 100).toFixed(2)}%`;
  return (
    <div>
      <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width }} />
      </div>
      <p className="mt-1 text-xs text-muted">{width}</p>
    </div>
  );
}

function toDistributionRows(states?: Record<string, number>) {
  if (!states) return [];
  return Object.entries(states)
    .map(([stat, probability]) => ({ stat, probability }))
    .sort((a, b) => b.probability - a.probability);
}

function clampProbability(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatStats(stats: Record<string, number>) {
  return Object.entries(stats)
    .map(([stat, value]) => `${stat} ${value.toFixed(2)}`)
    .join(" • ");
}

function TooltipIcon({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-[10px] text-muted">
      ?
      <span className="pointer-events-none absolute -top-2 right-6 w-56 translate-y-[-100%] rounded-lg border border-white/10 bg-[#0f0f16] p-2 text-[11px] text-muted opacity-0 shadow-soft transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
