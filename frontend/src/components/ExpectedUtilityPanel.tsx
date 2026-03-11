"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ArtifactInput, ExpectedUtilityResponse, UtilityFunction, UtilityTarget } from "@/types/artifact";

interface Props {
  artifact: ArtifactInput;
}

const utilityOptions: UtilityFunction[] = ["linear", "risk_averse"];
const targetOptions: UtilityTarget[] = ["next", "max"];

export function ExpectedUtilityPanel({ artifact }: Props) {
  const [utilityFn, setUtilityFn] = useState<UtilityFunction>("linear");
  const [riskLambda, setRiskLambda] = useState(0.2);
  const [mcSamples, setMcSamples] = useState(3000);
  const [target, setTarget] = useState<UtilityTarget>("next");
  const [result, setResult] = useState<ExpectedUtilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<ExpectedUtilityResponse>("/expected-utility", {
        artifact,
        utility_function: utilityFn,
        risk_lambda: riskLambda,
        mc_samples: mcSamples,
        to: target
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
          <h3 className="panel-title">Expected Utility</h3>
          <p className="text-sm text-muted">Modelo de utilidad para priorizar acciones de mejora.</p>
        </div>
        <button className="btn-primary" onClick={calculate} disabled={loading}>
          {loading ? "Computando..." : "Calcular"}
        </button>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="label">Utility function</label>
          <select className="input w-full" value={utilityFn} onChange={(e) => setUtilityFn(e.target.value as UtilityFunction)}>
            {utilityOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Risk lambda</label>
          <input
            className="input w-full"
            type="number"
            step={0.05}
            value={riskLambda}
            onChange={(e) => setRiskLambda(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="label">MC samples</label>
          <input
            className="input w-full"
            type="number"
            value={mcSamples}
            onChange={(e) => setMcSamples(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="label">Objetivo</label>
          <select className="input w-full" value={target} onChange={(e) => setTarget(e.target.value as UtilityTarget)}>
            {targetOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
          <p className="text-sm text-muted">Expected utility</p>
          <p className="text-3xl font-semibold">{result ? result.expected_utility.toFixed(3) : "—"}</p>
        </div>
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
          <p className="text-sm text-muted">Interpretación</p>
          <p className="text-sm text-text leading-relaxed">{result ? result.interpretation : "Pendiente de cálculo."}</p>
        </div>
        <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl space-y-2">
          <p className="text-sm text-muted">Breakdown</p>
          <div className="space-y-1">
            {result?.breakdown?.map((b, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm text-text bg-white/5 px-3 py-2 rounded-lg">
                <span>{b.label}</span>
                <span className="text-primary font-semibold">{b.value.toFixed(3)}</span>
              </div>
            )) || <p className="text-muted text-sm">Sin breakdown disponible.</p>}
          </div>
        </div>
      </div>

      {result && (
        <div className="card bg-gradient-to-r from-[#1a1a23] to-[#211b2f] border border-primary/20 p-4 rounded-xl shadow-soft">
          <p className="text-sm text-muted">Visualización</p>
          <div className="mt-2 h-3 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, result.expected_utility * 10))}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            Barra proporcional a la utilidad esperada (escala 0-10). Útil para comparar escenarios.
          </p>
        </div>
      )}
    </div>
  );
}
