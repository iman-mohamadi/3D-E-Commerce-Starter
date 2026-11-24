"use client";

import type { SizeGuide } from "@/shared/schemas/json";
import { Toggle } from "./ui";

const DEFAULT: SizeGuide = { unit: "cm", columns: ["chest", "length"], rows: [{ size: "S", measurements: { chest: 0, length: 0 } }] };

export function SizeGuideEditor({ value, onChange }: { value: SizeGuide | null; onChange: (v: SizeGuide | null) => void }) {
  if (!value) return <Toggle checked={false} onChange={() => onChange(DEFAULT)} label="Add a size guide" />;

  const setColumns = (text: string) => {
    const columns = [...new Set(text.split(",").map((c) => c.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean))];
    onChange({
      ...value,
      columns: columns.length ? columns : value.columns,
      rows: value.rows.map((r) => ({ ...r, measurements: Object.fromEntries(columns.map((c) => [c, r.measurements[c] ?? 0])) })),
    });
  };
  const setRow = (i: number, patch: Partial<SizeGuide["rows"][number]>) =>
    onChange({ ...value, rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Toggle checked onChange={() => onChange(null)} label="Size guide enabled" />
        <select className="input w-24" value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as "cm" | "in" })}>
          <option value="cm">cm</option>
          <option value="in">in</option>
        </select>
      </div>
      <label className="block">
        <span className="label">Columns (comma separated)</span>
        <input className="input" defaultValue={value.columns.join(", ")} onBlur={(e) => setColumns(e.target.value)} />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Size</th>
              {value.columns.map((c) => <th key={c} className="th capitalize">{c.replace(/_/g, " ")}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((r, i) => (
              <tr key={i}>
                <td className="pr-2 pb-2"><input className="input w-20" value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} /></td>
                {value.columns.map((c) => (
                  <td key={c} className="pr-2 pb-2">
                    <input
                      className="input w-24"
                      type="number"
                      step="0.5"
                      value={r.measurements[c] ?? 0}
                      onChange={(e) => setRow(i, { measurements: { ...r.measurements, [c]: Number(e.target.value) } })}
                    />
                  </td>
                ))}
                <td className="pb-2"><button type="button" className="btn btn-danger px-2" onClick={() => onChange({ ...value, rows: value.rows.filter((_, j) => j !== i) })} aria-label="Remove row">x</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" onClick={() => onChange({ ...value, rows: [...value.rows, { size: "", measurements: Object.fromEntries(value.columns.map((c) => [c, 0])) }] })}>
        Add size row
      </button>
    </div>
  );
}
