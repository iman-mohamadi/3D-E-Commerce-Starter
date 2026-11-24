"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { productInput } from "@/shared/schemas/admin";
import type { ProceduralConfig, TransformConfig } from "@/shared/schemas/json";
import { PROCEDURAL_DEFAULTS } from "@/three/garments/procedural";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { AssetUploader } from "../components/AssetUploader";
import { SizeGuideEditor } from "../components/SizeGuideEditor";
import { Field, MoneyInput, Toggle } from "../components/ui";
import { HotspotPanel, type PlacingState } from "./HotspotPanel";
import type { CollectionOption, HotspotDraft, PresetOption, ProductDraft, VariantDraft } from "./types";
import { VariantMatrix, newKey } from "./VariantMatrix";
import type { FocusRequest } from "./StudioViewport";

const StudioViewport = dynamic(() => import("./StudioViewport").then((m) => m.StudioViewport), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-raised" />,
});

type Tab = "details" | "media" | "variants" | "hotspots";
const KINDS: ProceduralConfig["kind"][] = ["tee", "shirt", "hoodie", "coat", "dress", "trousers", "custom"];
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);

interface Props {
  productId: string | null;
  initial: { draft: ProductDraft; variants: VariantDraft[]; hotspots: HotspotDraft[] };
  collections: CollectionOption[];
  presets: PresetOption[];
  storeThemePreset: string;
}

export function ProductEditor({ productId, initial, collections, presets, storeThemePreset }: Props) {
  const router = useRouter();
  const { notify, assetUrl } = useAdmin();
  const [tab, setTab] = useState<Tab>("details");
  const [draft, setDraft] = useState(initial.draft);
  const [variants, setVariants] = useState(initial.variants);
  const [hotspots, setHotspots] = useState(initial.hotspots);
  const [slugTouched, setSlugTouched] = useState(!!productId);
  const [saving, setSaving] = useState<null | "product" | "variants" | "hotspots">(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(initial.variants[0]?.key ?? null);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [placing, setPlacing] = useState<PlacingState>(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [presetSlug, setPresetSlug] = useState<string | null>(null);

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setT = (p: Partial<TransformConfig>) => set("transformConfig", { ...draft.transformConfig, ...p });

  const collection = collections.find((c) => c.id === draft.collectionId);
  const activePresetSlug = presetSlug ?? collection?.environmentPreset ?? storeThemePreset;
  const preset = presets.find((p) => p.slug === activePresetSlug) ?? presets[0] ?? null;

  const variant = variants.find((v) => v.key === activeVariant) ?? variants[0] ?? null;
  const look = useMemo(
    () => (variant ? { colorHex: /^#[0-9a-f]{6}$/i.test(variant.colorHex) ? variant.colorHex : "#808080", pbr: variant.pbrConfig } : { colorHex: "#8a8a8f", pbr: { roughness: 0.85, metalness: 0, meshTarget: "body" } }),
    [variant],
  );
  const stageHotspots = useMemo(() => hotspots.map((h) => ({ id: h.key, position: h.position3d })), [hotspots]);

  async function saveProduct() {
    const parsed = productInput.safeParse({ ...draft, glbUrl: draft.glbUrl || null, fallbackImageUrl: draft.fallbackImageUrl || null });
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return notify(`${i?.path.join(".")}: ${i?.message}`, "error");
    }
    setSaving("product");
    try {
      if (productId) {
        await api(`/api/admin/products/${productId}`, { method: "PATCH", body: parsed.data });
        notify("Product saved");
        router.refresh();
      } else {
        const { product } = await api<{ product: { id: string } }>("/api/admin/products", { body: parsed.data });
        notify("Product created");
        router.replace(`/admin/products/${product.id}`);
      }
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  async function saveVariants() {
    if (!productId) return;
    setSaving("variants");
    try {
      const body = { variants: variants.map(({ key: _k, ...v }) => v) };
      const res = await api<{ variants: (Omit<VariantDraft, "key"> & { id: string })[] }>(`/api/admin/products/${productId}/variants`, { method: "PUT", body });
      const next = res.variants.map((v) => ({ ...v, key: v.id }));
      setVariants(next);
      setActiveVariant((cur) => next.find((v) => v.sku === variants.find((x) => x.key === cur)?.sku)?.key ?? next[0]?.key ?? null);
      notify(`Saved ${next.length} variants`);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  async function saveHotspots() {
    if (!productId) return;
    setSaving("hotspots");
    try {
      const body = { hotspots: hotspots.map(({ key: _k, ...h }) => h) };
      const res = await api<{ hotspots: (Omit<HotspotDraft, "key"> & { id: string })[] }>(`/api/admin/products/${productId}/hotspots`, { method: "PUT", body });
      setHotspots(res.hotspots.map((h) => ({ ...h, key: h.id })));
      setSelectedHotspot(null);
      notify(`Saved ${res.hotspots.length} hotspots`);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!productId || !confirm(`Delete "${draft.title}"? Variants and hotspots are deleted too; past orders keep their snapshots.`)) return;
    try {
      await api(`/api/admin/products/${productId}`, { method: "DELETE" });
      router.replace("/admin/products");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function onPick(hit: { position: HotspotDraft["position3d"]; cameraOffset: HotspotDraft["cameraOffset"] }) {
    if (placing && placing.replaceKey) {
      setHotspots((hs) => hs.map((h) => (h.key === placing.replaceKey ? { ...h, position3d: hit.position, cameraOffset: hit.cameraOffset } : h)));
      setPlacing(false);
      return;
    }
    const key = newKey();
    setHotspots((hs) => [...hs, { key, label: `Hotspot ${hs.length + 1}`, description: "", position3d: hit.position, cameraOffset: hit.cameraOffset }]);
    setSelectedHotspot(key);
    setPlacing(false);
  }

  const proc = draft.proceduralConfig;
  const needsProduct = !productId;
  const tabs: [Tab, string][] = [["details", "Details"], ["media", "3D & media"], ["variants", `Variants (${variants.length})`], ["hotspots", `Hotspots (${hotspots.length})`]];

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      {/* ---------- left: forms ---------- */}
      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <nav className="flex gap-1 border-b border-line" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${tab === id ? "border-gold text-bone" : "border-transparent text-mute hover:text-bone"}`}>
                {label}
              </button>
            ))}
          </nav>
          <Link href="/admin/products" className="text-sm text-mute hover:text-bone">Back to products</Link>
        </div>

        {tab === "details" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Title">
                <input className="input" value={draft.title} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} />
              </Field>
              <Field label="Slug">
                <input className="input font-mono text-xs" value={draft.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
              </Field>
            </div>
            <Field label="Description">
              <textarea className="input min-h-28" value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Base price"><MoneyInput value={draft.basePrice} onChange={(m) => set("basePrice", m)} /></Field>
              <Field label="Rack (collection)">
                <select className="input" value={draft.collectionId ?? ""} onChange={(e) => set("collectionId", e.target.value || null)}>
                  <option value="">Unassigned</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </Field>
            </div>
            <Toggle checked={draft.isActive} onChange={(v) => set("isActive", v)} label="Active (visible in the storefront)" />
            <div>
              <div className="label">Size guide</div>
              <SizeGuideEditor value={draft.sizeGuide} onChange={(v) => set("sizeGuide", v)} />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-5">
              {productId ? <button className="btn btn-danger" onClick={remove}>Delete product</button> : <span />}
              <button className="btn btn-primary" disabled={saving !== null} onClick={saveProduct}>{saving === "product" ? "Saving..." : productId ? "Save product" : "Create product"}</button>
            </div>
          </div>
        )}

        {tab === "media" && (
          <div className="space-y-6">
            <AssetUploader kind="model" accept=".glb,model/gltf-binary" label="3D model (.glb, Draco supported)" value={draft.glbUrl} onChange={(k) => set("glbUrl", k)} />
            <AssetUploader kind="image" accept="image/png,image/jpeg,image/webp,image/avif" label="Fallback image (shown without WebGL)" value={draft.fallbackImageUrl} onChange={(k) => set("fallbackImageUrl", k)} preview />
            <div className="card space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="label !mb-0">Procedural fallback</div>
                  <p className="text-xs text-mute">Used while no GLB is uploaded (or if it fails to load).</p>
                </div>
                <Toggle checked={!!proc} onChange={(on) => set("proceduralConfig", on ? { kind: "tee", params: { ...PROCEDURAL_DEFAULTS.tee } } : null)} label={proc ? "On" : "Off"} />
              </div>
              {proc && (
                <>
                  <Field label="Garment type">
                    <select className="input" value={proc.kind} onChange={(e) => { const kind = e.target.value as ProceduralConfig["kind"]; set("proceduralConfig", { kind, params: { ...PROCEDURAL_DEFAULTS[kind] } }); }}>
                      {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.keys(PROCEDURAL_DEFAULTS[proc.kind]).map((key) => (
                      <Field key={key} label={key.replace(/([A-Z])/g, " $1")}>
                        <input className="input" type="number" step="0.01" value={proc.params[key] ?? PROCEDURAL_DEFAULTS[proc.kind][key]} onChange={(e) => set("proceduralConfig", { ...proc, params: { ...proc.params, [key]: Number(e.target.value) } })} />
                      </Field>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={saving !== null} onClick={saveProduct}>{saving === "product" ? "Saving..." : productId ? "Save product" : "Create product"}</button>
            </div>
          </div>
        )}

        {tab === "variants" &&
          (needsProduct ? (
            <p className="card px-6 py-10 text-center text-sm text-mute">Create the product first (Details tab), then manage its Color x Size matrix here.</p>
          ) : (
            <VariantMatrix variants={variants} onChange={setVariants} activeKey={variant?.key ?? null} onActivate={setActiveVariant} skuPrefix={draft.slug.split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 4)} onSave={saveVariants} saving={saving === "variants"} />
          ))}

        {tab === "hotspots" &&
          (needsProduct ? (
            <p className="card px-6 py-10 text-center text-sm text-mute">Create the product first, then place hotspots on the 3D garment.</p>
          ) : (
            <HotspotPanel hotspots={hotspots} onChange={setHotspots} selectedKey={selectedHotspot} onSelect={setSelectedHotspot} placing={placing} onPlacing={setPlacing} onFocus={(h) => setFocus({ position: h.position3d, cameraOffset: h.cameraOffset, nonce: Date.now() })} onSave={saveHotspots} saving={saving === "hotspots"} />
          ))}
      </div>

      {/* ---------- right: live 3D studio ---------- */}
      <aside className="xl:sticky xl:top-8 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl">3D Studio</h2>
          <select className="input w-48" aria-label="Lighting preset" value={activePresetSlug} onChange={(e) => setPresetSlug(e.target.value)}>
            {presets.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
        <StudioViewport
          className="h-[58vh] min-h-[380px]"
          preset={preset?.config ?? null}
          presetKey={activePresetSlug}
          resolveUrl={(k) => assetUrl(k) ?? k}
          glbUrl={draft.glbUrl}
          procedural={draft.proceduralConfig}
          fallbackImageUrl={assetUrl(draft.fallbackImageUrl)}
          transform={draft.transformConfig}
          look={look}
          hotspots={stageHotspots}
          selectedHotspotId={selectedHotspot}
          placing={!!placing}
          onPick={onPick}
          focus={focus}
        />
        <div className="card mt-3 space-y-3 p-4">
          <div className="label !mb-0">transform_config</div>
          <Slider label="Scale" min={0.3} max={2.5} step={0.01} value={draft.transformConfig.scale} onChange={(v) => setT({ scale: v })} />
          <Slider label="Offset Y" min={-0.8} max={0.8} step={0.005} value={draft.transformConfig.offsetY} onChange={(v) => setT({ offsetY: v })} />
          <Slider label="Rotation Y" min={-Math.PI} max={Math.PI} step={0.01} value={draft.transformConfig.rotationY} onChange={(v) => setT({ rotationY: v })} format={(v) => `${Math.round((v * 180) / Math.PI)} deg`} />
          <div className="flex items-center justify-between text-xs text-mute">
            <span>{variant ? `Previewing ${variant.colorName || "variant"} / ${variant.size || "-"}` : "Select a variant to preview its PBR"}</span>
            <button type="button" className="underline-offset-4 hover:text-bone hover:underline" onClick={() => setT({ scale: 1, offsetY: 0, rotationY: 0 })}>Reset</button>
          </div>
          <p className="text-[11px] text-mute">Transform edits apply instantly to the preview; click &quot;Save product&quot; to persist them.</p>
        </div>
      </aside>
    </div>
  );
}

function Slider(p: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="grid grid-cols-[80px_1fr_70px] items-center gap-3 text-sm">
      <span className="text-mute">{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} className="accent-[#c8a97e]" />
      <span className="text-right font-mono text-xs">{p.format ? p.format(p.value) : p.value.toFixed(2)}</span>
    </label>
  );
}
