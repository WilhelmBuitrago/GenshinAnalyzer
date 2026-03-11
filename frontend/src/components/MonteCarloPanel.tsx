"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { ArtifactInput, MonteCarloResponse, StatKey } from "@/types/artifact";

interface Props {
  artifact: ArtifactInput;
}

const statLabels: Record<StatKey, string> = {
  HP: "HP",
  ATK: "ATK",
  DEF: "DEF",
  "HP%": "HP%",
  "ATK%": "ATK%",
  "DEF%": "DEF%",
  ER: "ER",
  EM: "EM",
  CR: "CRIT Rate",
  CD: "CRIT DMG"
};

export function MonteCarloPanel({ artifact }: Props) {
  const [samples, setSamples] = useState(5000);
  const [data, setData] = useState<MonteCarloResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSim = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<MonteCarloResponse>("/monte-carlo", {
        artifact,
        samples
      });
      setData(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const distributionByStat = data?.distribution.reduce<Record<StatKey, { stat: StatKey; value: number }[]>>(
    (acc, cur) => {
      acc[cur.stat] = acc[cur.stat] ? [...acc[cur.stat], cur] : [cur];
      return acc;
    },
    {} as Record<StatKey, { stat: StatKey; value: number }[]>
  );

  return (
    <div className="card card-hover p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="panel-title">Simulación Monte Carlo</h3>
          <p className="text-sm text-muted">Estimación estadística de outcomes por stat.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-32"
            type="number"
            value={samples}
            onChange={(e) => setSamples(Number(e.target.value))}
          />
          <button className="btn-primary" onClick={runSim} disabled={loading}>
            {loading ? "Simulando..." : "Ejecutar"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      {loading && <div className="h-64 skeleton" />}

      {!loading && !data && !error && (
        <div className="h-64 flex items-center justify-center text-muted text-sm">
          Ejecuta la simulación para visualizar la distribución.
        </div>
      )}

      {!loading && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniStat title="Media" value={fmt(data.mean)} />
            <MiniStat title="Mínimo" value={fmt(data.min)} />
            <MiniStat title="Máximo" value={fmt(data.max)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {distributionByStat &&
              Object.entries(distributionByStat).map(([stat, dist]) => (
                <div key={stat} className="card bg-[#111119] border border-white/5 p-3 rounded-xl space-y-2">
                  <p className="text-sm text-muted">Distribución {statLabels[stat as StatKey]}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dist} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                        <XAxis dataKey="value" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ background: "#1A1A23", border: "1px solid #2a2a36", borderRadius: 12 }}
                          labelStyle={{ color: "#E5E7EB" }}
                        />
                        <Bar dataKey="value" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl">
      <p className="text-sm text-muted">{title}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

function fmt(record: Record<StatKey, number>) {
  return Object.entries(record)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(" • ");
}
