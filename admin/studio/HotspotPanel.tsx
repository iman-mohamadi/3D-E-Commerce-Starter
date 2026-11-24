"use client";

import type { HotspotDraft } from "./types";

export type PlacingState = false | { replaceKey?: string };

interface Props {
  hotspots: HotspotDraft[];
  onChange: (h: HotspotDraft[]) => void;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  placing: PlacingState;
  onPlacing: (p: PlacingState) => void;
  onFocus: (h: HotspotDraft) => void;
  onSave: () => void;
  saving: boolean;
}

const fmt = (n: number) => n.toFixed(3);

export function HotspotPanel({ hotspots, onChange, selectedKey, onSelect, placing, onPlacing, onFocus, onSave, saving }: Props) {
  const patch = (key: string, p: Partial<HotspotDraft>) => onChange(hotspots.map((h) => (h.key === key ? { ...h, ...p } : h)));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mute">Arm the placer, then click the garment in the 3D view. The hit point and current camera angle are captured.</p>
        <button type="button" className={`btn shrink-0 ${placing && !placing.replaceKey ? "border-gold text-gold" : ""}`} onClick={() => onPlacing(placing ? false : {})}>
          {placing && !placing.replaceKey ? "Cancel placing" : "Place hotspot"}
        </button>
      </div>

      <ul className="space-y-2">
        {hotspots.length === 0 && <li className="card px-4 py-8 text-center text-sm text-mute">No hotspots yet.</li>}
        {hotspots.map((h, i) => {
          const sel = h.key === selectedKey;
          return (
            <li key={h.key} className={`card p-3 ${sel ? "border-gold" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-xs">{i + 1}</span>
                <input className="input" value={h.label} placeholder="Label" onFocus={() => onSelect(h.key)} onChange={(e) => patch(h.key, { label: e.target.value })} />
                <button type="button" className="btn px-3" onClick={() => { onSelect(h.key); onFocus(h); }}>Focus</button>
                <button type="button" className="btn btn-danger px-2" aria-label="Delete hotspot" onClick={() => { onChange(hotspots.filter((x) => x.key !== h.key)); if (sel) onSelect(null); }}>x</button>
              </div>
              {sel && (
                <div className="mt-3 space-y-2">
                  <textarea className="input min-h-20" placeholder="Description shown to shoppers" value={h.description} onChange={(e) => patch(h.key, { description: e.target.value })} />
                  <div className="flex items-center justify-between text-xs text-mute">
                    <span className="font-mono">pos ({fmt(h.position3d.x)}, {fmt(h.position3d.y)}, {fmt(h.position3d.z)}) / cam ({fmt(h.cameraOffset.x)}, {fmt(h.cameraOffset.y)}, {fmt(h.cameraOffset.z)})</span>
                    <button type="button" className={`btn px-3 py-1 ${placing && placing.replaceKey === h.key ? "border-gold text-gold" : ""}`} onClick={() => onPlacing(placing && placing.replaceKey === h.key ? false : { replaceKey: h.key })}>
                      {placing && placing.replaceKey === h.key ? "Click the garment..." : "Re-pick position"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving..." : "Save hotspots"}</button>
      </div>
    </div>
  );
}
