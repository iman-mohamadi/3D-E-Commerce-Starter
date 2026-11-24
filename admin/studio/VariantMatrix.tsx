"use client";

import { useState } from "react";
import { MoneyInput } from "../components/ui";
import type { VariantDraft } from "./types";

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${seq++}`;

interface Props {
  variants: VariantDraft[];
  onChange: (v: VariantDraft[]) => void;
  activeKey: string | null;
  onActivate: (key: string) => void;
  skuPrefix: string;
  onSave: () => void;
  saving: boolean;
}

const code = (s: string) => s.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "VAR";

export function VariantMatrix({ variants, onChange, activeKey, onActivate, skuPrefix, onSave, saving }: Props) {
  const [colorsText, setColorsText] = useState("Onyx:#16161a, Bone:#e8e0d2");
  const [sizesText, setSizesText] = useState("S, M, L, XL");
  const [stock, setStock] = useState(10);

  const patch = (key: string, p: Partial<VariantDraft>) => onChange(variants.map((v) => (v.key === key ? { ...v, ...p } : v)));
  const patchPbr = (key: string, p: Partial<VariantDraft["pbrConfig"]>) =>
    onChange(variants.map((v) => (v.key === key ? { ...v, pbrConfig: { ...v.pbrConfig, ...p } } : v)));

  function generate() {
    const colors = colorsText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [name, hex] = c.split(":").map((x) => x.trim());
        return { name: name ?? "", hex: /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex! : "#808080" };
      });
    const sizes = sizesText.split(",").map((s) => s.trim()).filter(Boolean);
    const have = new Set(variants.map((v) => `${v.colorName.toLowerCase()}|${v.size.toLowerCase()}`));
    const added: VariantDraft[] = [];
    for (const c of colors)
      for (const s of sizes) {
        if (have.has(`${c.name.toLowerCase()}|${s.toLowerCase()}`)) continue;
        added.push({
          key: newKey(),
          sku: `${skuPrefix || "SKU"}-${code(c.name)}-${s.toUpperCase()}`,
          colorName: c.name,
          colorHex: c.hex,
          pbrConfig: { roughness: 0.8, metalness: 0, meshTarget: "body" },
          size: s,
          stock,
          priceDelta: 0,
        });
      }
    onChange([...variants, ...added]);
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-4">
        <div className="label">Generate Color x Size matrix (adds only missing combinations)</div>
        <div className="grid grid-cols-[2fr_1.2fr_80px_auto] items-end gap-3">
          <label><span className="label">Colors (Name:#hex)</span><input className="input" value={colorsText} onChange={(e) => setColorsText(e.target.value)} /></label>
          <label><span className="label">Sizes</span><input className="input" value={sizesText} onChange={(e) => setSizesText(e.target.value)} /></label>
          <label><span className="label">Stock</span><input className="input" type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} /></label>
          <button type="button" className="btn" onClick={generate}>Generate</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-line">
            <tr>
              <th className="th w-10">3D</th><th className="th">SKU</th><th className="th">Color</th><th className="th">Size</th>
              <th className="th">Stock</th><th className="th">Price delta</th><th className="th">Roughness</th><th className="th">Metalness</th><th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {variants.length === 0 && <tr><td colSpan={9} className="td py-10 text-center text-mute">No variants yet. Generate a matrix above or add a row.</td></tr>}
            {variants.map((v) => (
              <tr key={v.key} className={activeKey === v.key ? "bg-raised/60" : ""}>
                <td className="td"><input type="radio" name="active-variant" checked={activeKey === v.key} onChange={() => onActivate(v.key)} aria-label={`Preview ${v.sku} in 3D`} /></td>
                <td className="td"><input className="input w-36 font-mono text-xs" value={v.sku} onChange={(e) => patch(v.key, { sku: e.target.value })} /></td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <input type="color" value={v.colorHex} onChange={(e) => patch(v.key, { colorHex: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded-sm border border-line bg-transparent p-0.5" aria-label="Color" />
                    <div className="space-y-1">
                      <input className="input w-28" value={v.colorName} onChange={(e) => patch(v.key, { colorName: e.target.value })} />
                      <input className="input w-28 font-mono text-xs" value={v.colorHex} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && patch(v.key, { colorHex: e.target.value })} />
                    </div>
                  </div>
                </td>
                <td className="td"><input className="input w-16" value={v.size} onChange={(e) => patch(v.key, { size: e.target.value })} /></td>
                <td className="td"><input className="input w-20" type="number" min={0} value={v.stock} onChange={(e) => patch(v.key, { stock: Math.max(0, Math.round(Number(e.target.value))) })} /></td>
                <td className="td w-40"><MoneyInput value={v.priceDelta} onChange={(m) => patch(v.key, { priceDelta: m })} /></td>
                <td className="td w-36">
                  <input type="range" min={0} max={1} step={0.01} value={v.pbrConfig.roughness} onFocus={() => onActivate(v.key)} onChange={(e) => { onActivate(v.key); patchPbr(v.key, { roughness: Number(e.target.value) }); }} className="w-full accent-[#c8a97e]" />
                  <div className="text-xs text-mute">{v.pbrConfig.roughness.toFixed(2)}</div>
                </td>
                <td className="td w-36">
                  <input type="range" min={0} max={1} step={0.01} value={v.pbrConfig.metalness} onFocus={() => onActivate(v.key)} onChange={(e) => { onActivate(v.key); patchPbr(v.key, { metalness: Number(e.target.value) }); }} className="w-full accent-[#c8a97e]" />
                  <div className="text-xs text-mute">{v.pbrConfig.metalness.toFixed(2)}</div>
                  <input className="input mt-1 h-7 w-full text-xs" value={v.pbrConfig.meshTarget} title="Mesh / material name to tint (procedural: body)" onChange={(e) => patchPbr(v.key, { meshTarget: e.target.value || "body" })} />
                </td>
                <td className="td"><button type="button" className="btn btn-danger px-2" aria-label={`Remove ${v.sku}`} onClick={() => onChange(variants.filter((x) => x.key !== v.key))}>x</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          className="btn"
          onClick={() => onChange([...variants, { key: newKey(), sku: "", colorName: "", colorHex: "#808080", pbrConfig: { roughness: 0.8, metalness: 0, meshTarget: "body" }, size: "", stock: 0, priceDelta: 0 }])}
        >
          Add row
        </button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving..." : "Save variants"}</button>
      </div>
    </div>
  );
}
