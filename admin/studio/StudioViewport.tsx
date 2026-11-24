"use client";

import { useEffect, useRef, useState } from "react";
import type { LightingConfig, PbrConfig, ProceduralConfig, StudioPresetConfig, TransformConfig, Vec3 } from "@/shared/schemas/json";
import { GarmentStage, StudioEngine, type PickResult, type StageHotspot } from "@/three";

export interface FocusRequest {
  position: Vec3;
  cameraOffset: Vec3;
  nonce: number;
}

interface Props {
  preset: StudioPresetConfig | null;
  /** Changing this resets the camera to the preset's camera (use the preset slug). */
  presetKey: string;
  lightingOverride?: Partial<LightingConfig>;
  resolveUrl: (keyOrUrl: string) => string;
  glbUrl: string | null;
  procedural: ProceduralConfig | null;
  fallbackImageUrl?: string | null;
  transform: TransformConfig;
  look: { colorHex: string; pbr: PbrConfig } | null;
  hotspots: StageHotspot[];
  selectedHotspotId: string | null;
  placing: boolean;
  onPick?: (r: PickResult) => void;
  focus?: FocusRequest | null;
  className?: string;
}

/**
 * React host for the shared three/ engine. Props -> engine/stage updates; unmount disposes everything.
 * The same StudioEngine + GarmentStage are used by the storefront in Phase 3.
 */
export function StudioViewport(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<GarmentStage | null>(null);
  const engineRef = useRef<StudioEngine | null>(null);
  const [state, setState] = useState<"init" | "ok" | "no-webgl" | "lost">("init");
  const [kind, setKind] = useState<"glb" | "procedural" | "none" | "loading">("loading");
  const resolveRef = useRef(p.resolveUrl);
  resolveRef.current = p.resolveUrl;

  // engine + stage lifecycle
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const engine = StudioEngine.create(el, {
      resolveUrl: (k) => resolveRef.current(k),
      onContextLost: () => setState("lost"),
    });
    if (!engine) {
      setState("no-webgl");
      return;
    }
    engineRef.current = engine;
    const s = new GarmentStage(engine);
    setStage(s);
    setState("ok");
    return () => {
      s.dispose();
      engine.dispose();
      engineRef.current = null;
      setStage(null);
    };
  }, []);

  // studio_presets -> lighting rig, rack rail, camera
  const presetJson = JSON.stringify(p.preset);
  const overrideJson = JSON.stringify(p.lightingOverride ?? null);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !stage || !p.preset) return;
    engine.setPreset(p.preset, { resetCamera: lastKey.current !== p.presetKey, override: p.lightingOverride });
    lastKey.current = p.presetKey;
    stage.setRack(p.preset.rack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, presetJson, overrideJson, p.presetKey]);

  // garment source
  const procJson = JSON.stringify(p.procedural);
  useEffect(() => {
    if (!stage) return;
    setKind("loading");
    let live = true;
    stage.load({ glbUrl: p.glbUrl ? p.resolveUrl(p.glbUrl) : null, procedural: p.procedural }).then((k) => live && k !== "none" && setKind(k));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, p.glbUrl, procJson]);

  useEffect(() => stage?.setTransform(p.transform), [stage, p.transform.scale, p.transform.offsetY, p.transform.rotationY]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stage && p.look) stage.setVariantLook(p.look.colorHex, p.look.pbr);
  }, [stage, p.look?.colorHex, p.look?.pbr.roughness, p.look?.pbr.metalness, p.look?.pbr.meshTarget, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => stage?.setHotspots(p.hotspots, p.selectedHotspotId), [stage, p.hotspots, p.selectedHotspotId]);
  useEffect(() => {
    if (stage && p.focus) stage.focus(p.focus.position, p.focus.cameraOffset);
  }, [stage, p.focus]);

  // click (not drag) to place a hotspot
  const down = useRef<{ x: number; y: number } | null>(null);
  const onUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!p.placing || !stage || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const hit = stage.pick(e);
    if (hit) p.onPick?.(hit);
  };

  return (
    <div className={`relative overflow-hidden rounded-sm border border-line bg-ink ${p.className ?? ""}`}>
      <div
        ref={host}
        className={`absolute inset-0 ${p.placing ? "cursor-crosshair" : "cursor-grab"}`}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={onUp}
      />
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2 text-[10px] uppercase tracking-widest">
        {kind === "procedural" && <span className="chip bg-ink/70">Procedural fallback</span>}
        {kind === "glb" && <span className="chip bg-ink/70 text-emerald-300">GLB model</span>}
        {kind === "loading" && state === "ok" && <span className="chip bg-ink/70">Loading...</span>}
        {p.placing && <span className="chip border-gold bg-ink/80 text-gold">Click the garment to place</span>}
      </div>
      {(state === "no-webgl" || state === "lost") && (
        <div className="absolute inset-0 grid place-items-center bg-ink p-6 text-center text-sm text-mute">
          {p.fallbackImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.fallbackImageUrl} alt="Fallback" className="max-h-full object-contain" />
          ) : (
            <p>{state === "lost" ? "The graphics context was lost. Reload the page to restore the 3D preview." : "WebGL is not available in this browser, so the 3D preview is disabled."}</p>
          )}
        </div>
      )}
    </div>
  );
}
