"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { studioPresetConfig, type StudioPresetConfig } from "@/shared/schemas/json";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { Field } from "./ui";

const StudioViewport = dynamic(() => import("../studio/StudioViewport").then((m) => m.StudioViewport), { ssr: false, loading: () => <div className="h-full animate-pulse bg-raised" /> });

export interface PresetRow {
  id: string;
  slug: string;
  name: string;
  config: StudioPresetConfig;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function PresetEditor({ presets, activeThemeSlug }: { presets: PresetRow[]; activeThemeSlug: string }) {
  const router = useRouter();
  const { notify, assetUrl } = useAdmin();
  const [selectedId, setSelectedId] = useState<string | "new">(presets.find((p) => p.slug === activeThemeSlug)?.id ?? presets[0]?.id ?? "new");
  const selected = presets.find((p) => p.id === selectedId) ?? null;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cfg, setCfg] = useState<StudioPresetConfig | null>(null);
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const base = selected?.config ?? presets[0]?.config;
    if (!base) return;
    const c = clone(base);
    setCfg(c);
    setJson(JSON.stringify(c, null, 2));
    setJsonError(null);
    setName(selected ? selected.name : "");
    setSlug(selected ? selected.slug : "");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return <p className="card px-6 py-10 text-center text-sm text-mute">No presets yet and nothing to clone from. Run the seed to create the default preset.</p>;

  const L = cfg.lighting;
  const update = (fn: (c: StudioPresetConfig) => void) => {
    const next = clone(cfg);
    fn(next);
    setCfg(next);
    setJson(JSON.stringify(next, null, 2));
    setJsonError(null);
  };

  function applyJson(text: string) {
    setJson(text);
    try {
      const r = studioPresetConfig.safeParse(JSON.parse(text));
      if (!r.success) return setJsonError(`${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}`);
      setCfg(r.data);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }

  async function save() {
    if (jsonError) return notify("Fix the JSON errors first", "error");
    setBusy(true);
    try {
      const body = { slug, name, config: cfg };
      if (selected) await api(`/api/admin/presets/${selected.id}`, { method: "PUT", body });
      else {
        const { preset } = await api<{ preset: PresetRow }>("/api/admin/presets", { body });
        setSelectedId(preset.id);
      }
      notify("Preset saved");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || !confirm(`Delete preset "${selected.name}"? Racks using it fall back to the store theme.`)) return;
    try {
      await api(`/api/admin/presets/${selected.id}`, { method: "DELETE" });
      setSelectedId(presets.find((p) => p.id !== selected.id)?.id ?? "new");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
      <div className="space-y-5">
        <div className="flex items-end gap-3">
          <Field label="Preset" className="flex-1">
            <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}{p.slug === activeThemeSlug ? " (store theme)" : ""}</option>)}
              <option value="new">+ New preset (starts from the first preset)</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name"><input className="input" value={name} onChange={(e) => { setName(e.target.value); if (!selected) setSlug(slugify(e.target.value)); }} /></Field>
          <Field label="Slug"><input className="input font-mono text-xs" value={slug} onChange={(e) => setSlug(e.target.value)} /></Field>
        </div>

        <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-4">
          <Color label="Background" value={L.background} onChange={(v) => update((c) => { c.lighting.background = v; if (c.lighting.fog) c.lighting.fog.color = v; })} />
          <Range label="Exposure" min={0.2} max={2.5} step={0.01} value={L.toneMappingExposure} onChange={(v) => update((c) => { c.lighting.toneMappingExposure = v; })} />
          <Color label="Ambient color" value={L.ambient.color} onChange={(v) => update((c) => { c.lighting.ambient.color = v; })} />
          <Range label="Ambient intensity" min={0} max={2} step={0.01} value={L.ambient.intensity} onChange={(v) => update((c) => { c.lighting.ambient.intensity = v; })} />
          <Color label="Key color" value={L.key.color} onChange={(v) => update((c) => { c.lighting.key.color = v; })} />
          <Range label="Key intensity" min={0} max={8} step={0.05} value={L.key.intensity} onChange={(v) => update((c) => { c.lighting.key.intensity = v; })} />
          {L.fill && <Range label="Fill intensity" min={0} max={4} step={0.05} value={L.fill.intensity} onChange={(v) => update((c) => { c.lighting.fill!.intensity = v; })} />}
          {L.rim && <Range label="Rim intensity" min={0} max={6} step={0.05} value={L.rim.intensity} onChange={(v) => update((c) => { c.lighting.rim!.intensity = v; })} />}
          <Range label="Environment intensity" min={0} max={2} step={0.01} value={L.environmentIntensity} onChange={(v) => update((c) => { c.lighting.environmentIntensity = v; })} />
          {L.floor && (
            <>
              <Color label="Floor color" value={L.floor.color} onChange={(v) => update((c) => { c.lighting.floor!.color = v; })} />
              <Range label="Floor roughness" min={0} max={1} step={0.01} value={L.floor.roughness} onChange={(v) => update((c) => { c.lighting.floor!.roughness = v; })} />
            </>
          )}
          <Range label="Camera FOV" min={15} max={70} step={1} value={cfg.camera.fov} onChange={(v) => update((c) => { c.camera.fov = v; })} />
          <Color label="Rail color" value={cfg.rack.railColor} onChange={(v) => update((c) => { c.rack.railColor = v; })} />
        </div>

        <details className="card p-4">
          <summary className="cursor-pointer text-sm">Advanced: full preset JSON (validated against the shared Zod schema)</summary>
          <textarea className={`input mt-3 min-h-72 font-mono text-xs ${jsonError ? "border-red-700" : ""}`} value={json} spellCheck={false} onChange={(e) => applyJson(e.target.value)} />
          {jsonError && <p className="mt-1 text-xs text-red-300">{jsonError}</p>}
        </details>

        <div className="flex justify-between border-t border-line pt-4">
          {selected ? <button className="btn btn-danger" onClick={remove}>Delete preset</button> : <span />}
          <button className="btn btn-primary" disabled={busy || !name || !slug} onClick={save}>{busy ? "Saving..." : selected ? "Save preset" : "Create preset"}</button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <h3 className="mb-2 font-display text-2xl">Live preview</h3>
        <StudioViewport
          className="h-[52vh] min-h-[340px]"
          preset={cfg}
          presetKey={selectedId}
          resolveUrl={(k) => assetUrl(k) ?? k}
          glbUrl={null}
          procedural={{ kind: "coat", params: {} }}
          transform={{ scale: 1, offsetY: 0, rotationY: 0 }}
          look={{ colorHex: "#6b6b73", pbr: { roughness: 0.85, metalness: 0, meshTarget: "body" } }}
          hotspots={[]}
          selectedHotspotId={null}
          placing={false}
        />
      </aside>
    </div>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-mute">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs">{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-sm border border-line bg-transparent p-0.5" />
      </span>
    </label>
  );
}

function Range(p: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="grid grid-cols-[110px_1fr_46px] items-center gap-2 text-sm">
      <span className="text-mute">{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} className="accent-[#c8a97e]" />
      <span className="text-right font-mono text-xs">{p.value.toFixed(2)}</span>
    </label>
  );
}
