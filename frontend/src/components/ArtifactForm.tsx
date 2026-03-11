"use client";

import { useEffect, useState } from "react";
import type { ArtifactInput, StatKey, Substat } from "@/types/artifact";

const statOptions: StatKey[] = ["HP", "ATK", "DEF", "HP%", "ATK%", "DEF%", "ER", "EM", "CR", "CD"];

interface ArtifactFormProps {
  value: ArtifactInput;
  onChange: (artifact: ArtifactInput) => void;
}

export function ArtifactForm({ value, onChange }: ArtifactFormProps) {
  const [local, setLocal] = useState<ArtifactInput>(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const update = (partial: Partial<ArtifactInput>) => {
    const next = { ...local, ...partial };
    setLocal(next);
    onChange(next);
  };

  const updateSubstat = (index: number, partial: Partial<Substat>) => {
    const next = local.substats.map((s, i) => (i === index ? { ...s, ...partial } : s));
    update({ substats: next });
  };

  const addSubstat = () => {
    update({ substats: [...local.substats, { stat: "CR", value: 0 }] });
  };

  const removeSubstat = (index: number) => {
    const next = local.substats.filter((_, i) => i !== index);
    update({ substats: next });
  };

  return (
    <div className="card card-hover p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted uppercase">Artefacto</p>
          <h3 className="panel-title">Definición del artefacto</h3>
        </div>
        <div className="flex gap-2 text-xs text-muted">
          <span className="px-2 py-1 bg-white/5 rounded-full">Compartido en todo el dashboard</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="label">Rareza</label>
          <select
            className="input w-full"
            value={local.rarity}
            onChange={(e) => update({ rarity: Number(e.target.value) as ArtifactInput["rarity"] })}
          >
            {[3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}⭐
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Nivel</label>
          <input
            className="input w-full"
            type="number"
            min={0}
            max={20}
            value={local.level}
            onChange={(e) => update({ level: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <label className="label">Main stat</label>
          <select
            className="input w-full"
            value={local.main_stat}
            onChange={(e) => update({ main_stat: e.target.value as StatKey })}
          >
            {statOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Substats</p>
            <p className="text-sm text-muted">Define substats iniciales. Agrega o elimina filas.</p>
          </div>
          <button type="button" className="btn-primary" onClick={addSubstat}>
            + Agregar substat
          </button>
        </div>
        <div className="space-y-2">
          {local.substats.length === 0 && (
            <div className="text-sm text-muted bg-white/5 rounded-xl p-3 border border-dashed border-white/10">
              Sin substats aún. Agrega al menos uno para simular.
            </div>
          )}
          {local.substats.map((sub, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111119] border border-white/5 rounded-xl px-3 py-2">
              <div className="col-span-5">
                <select
                  className="input w-full"
                  value={sub.stat}
                  onChange={(e) => updateSubstat(index, { stat: e.target.value as StatKey })}
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
                  value={sub.value}
                  onChange={(e) => updateSubstat(index, { value: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button type="button" className="btn-secondary w-full" onClick={() => removeSubstat(index)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
