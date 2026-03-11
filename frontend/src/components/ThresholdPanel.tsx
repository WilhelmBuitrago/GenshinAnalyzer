"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ArtifactInput, ProbabilityThresholdResponse, StatKey } from "@/types/artifact";

interface ThresholdEntry {
  stat: StatKey;
  value: number;
}

interface Props {
  artifact: ArtifactInput;
}

const statOptions: StatKey[] = ["HP", "ATK", "DEF", "HP%", "ATK%", "DEF%", "ER", "EM", "CR", "CD"];

export function ThresholdPanel({ artifact }: Props) {
  const [entries, setEntries] = useState<ThresholdEntry[]>([{ stat: "CR", value: 10 }]);
  const [result, setResult] = useState<ProbabilityThresholdResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEntry = (index: number, partial: Partial<ThresholdEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...partial } : e)));
  };

  const addEntry = () => setEntries([...entries, { stat: "CR", value: 0 }]);
  const removeEntry = (index: number) => setEntries(entries.filter((_, i) => i !== index));

  const calculate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<ProbabilityThresholdResponse>("/probability-threshold", {
        artifact,
        thresholds: entries
      });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card card-hover p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="panel-title">Probabilidad por umbral</h3>
          <p className="text-sm text-muted">Define objetivos por stat y estima la probabilidad de cumplirlos.</p>
        </div>
        <button className="btn-primary" onClick={calculate} disabled={loading}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label">Umbrales</p>
          <button className="btn-secondary" onClick={addEntry}>
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111119] border border-white/5 rounded-xl px-3 py-2">
              <div className="col-span-5">
                <select
                  className="input w-full"
                  value={entry.stat}
                  onChange={(e) => updateEntry(index, { stat: e.target.value as StatKey })}
                >
                  {statOptions.map((s) => (
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
                  value={entry.value}
                  onChange={(e) => updateEntry(index, { value: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button className="btn-secondary w-full" onClick={() => removeEntry(index)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
        <p className="text-sm text-muted">Probabilidad</p>
        <p className="text-3xl font-semibold">
          {result ? `${(result.probability * 100).toFixed(2)}%` : "—"}
        </p>
      </div>
    </div>
  );
}
