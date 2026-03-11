"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { ArtifactInput, DistributionResponse } from "@/types/artifact";

interface Props {
  artifact: ArtifactInput;
}

export function DistributionPanel({ artifact }: Props) {
  const [data, setData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<DistributionResponse>("/distribution-events", artifact);
      setData(res.data);
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
          <h3 className="panel-title">Distribución de eventos</h3>
          <p className="text-sm text-muted">Próximo upgrade y nivel máximo simulados.</p>
        </div>
        <button className="btn-primary" onClick={fetchData} disabled={loading}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      {loading && <div className="h-64 skeleton" />}

      {!loading && !data && !error && (
        <div className="h-64 flex items-center justify-center text-muted text-sm">
          Ejecuta el cálculo para ver las distribuciones.
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Chart title="Siguiente evento" data={data.next_event} />
          <Chart title="Nivel máximo" data={data.max_level} />
        </div>
      )}
    </div>
  );
}

function Chart({ title, data }: { title: string; data: { label: string; probability: number }[] }) {
  return (
    <div className="card bg-[#111119] border border-white/5 p-3 rounded-xl space-y-2">
      <p className="text-sm text-muted">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
            <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "#1A1A23", border: "1px solid #2a2a36", borderRadius: 12 }}
              labelStyle={{ color: "#E5E7EB" }}
            />
            <Bar dataKey="probability" fill="#7C3AED" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
