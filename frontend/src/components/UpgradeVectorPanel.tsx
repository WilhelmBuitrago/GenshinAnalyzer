"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ArtifactInput, ProbabilityUpgradeVectorResponse } from "@/types/artifact";

interface Props {
  artifact: ArtifactInput;
}

export function UpgradeVectorPanel({ artifact }: Props) {
  const [vector, setVector] = useState<number[]>([1, 1, 1]);
  const [result, setResult] = useState<ProbabilityUpgradeVectorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateVector = (index: number, value: number) => {
    const next = vector.map((v, i) => (i === index ? value : v));
    setVector(next);
  };

  const addEntry = () => setVector([...vector, 1]);
  const removeEntry = (index: number) => setVector(vector.filter((_, i) => i !== index));

  const calculate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<ProbabilityUpgradeVectorResponse>("/probability-upgrade-vector", {
        artifact,
        vector
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
          <h3 className="panel-title">Vector de upgrades</h3>
          <p className="text-sm text-muted">Define la secuencia de mejoras y calcula su probabilidad.</p>
        </div>
        <button className="btn-primary" onClick={calculate} disabled={loading}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label">Entradas del vector</p>
          <button className="btn-secondary" onClick={addEntry}>
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {vector.map((value, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111119] border border-white/5 rounded-xl px-3 py-2">
              <div className="col-span-9 md:col-span-10">
                <input
                  className="input w-full"
                  type="number"
                  value={value}
                  onChange={(e) => updateVector(index, Number(e.target.value))}
                />
              </div>
              <div className="col-span-3 md:col-span-2 flex justify-end">
                <button className="btn-secondary w-full" onClick={() => removeEntry(index)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
          <p className="text-sm text-muted">Longitud</p>
          <p className="text-2xl font-semibold">{vector.length}</p>
        </div>
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
          <p className="text-sm text-muted">Suma</p>
          <p className="text-2xl font-semibold">{vector.reduce((a, b) => a + b, 0)}</p>
        </div>
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
          <p className="text-sm text-muted">Probabilidad</p>
          <p className="text-2xl font-semibold">
            {result ? `${(result.probability * 100).toFixed(2)}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
