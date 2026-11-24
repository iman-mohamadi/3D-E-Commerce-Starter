"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { LightingConfig, PbrConfig, StudioPresetConfig } from "@/shared/schemas/json";
import { FALLBACK_PRESET, RackStage, StudioEngine, type RackEvents, type RackItem, type ViewPreset } from "@/three";

export interface SceneController {
  stepVisual: (v: 1 | -1) => void;
  goTo: (index: number) => void;
}

interface Props {
  rackKey: string;
  preset: StudioPresetConfig | null;
  lightingOverride?: Partial<LightingConfig>;
  items: RackItem[];
  rtl: boolean;
  /** Preloader finished: play the cinematic entrance. */
  revealed: boolean;
  inspectIndex: number | null;
  inset: { x: number; y: number };
  view: ViewPreset;
  viewNonce: number;
  look: { index: number; colorHex: string; pbr: PbrConfig } | null;
  selectedHotspot: string | null;
  hotspotNonce: number;
  controller: MutableRefObject<SceneController | null>;
  onProgress: (loaded: number, total: number) => void;
  onLoaded: () => void;
  onUnsupported: () => void;
  events: RackEvents;
}

/** React host for the shared three/ engine + RackStage. Props drive the stage; unmount disposes everything. */
export function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<RackStage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const engineRef = useRef<StudioEngine | null>(null);
  const entered = useRef(false);
  const latest = useRef(p);
  latest.current = p;

  // engine + stage lifecycle
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const engine = StudioEngine.create(el, { onContextLost: () => latest.current.onUnsupported() });
    if (!engine) {
      latest.current.onUnsupported();
      return;
    }
    engineRef.current = engine;
    const s = new RackStage(engine, { rtl: latest.current.rtl });
    s.events = {
      onHover: (h) => latest.current.events.onHover?.(h),
      onSelect: (i) => latest.current.events.onSelect?.(i),
      onHotspot: (id) => latest.current.events.onHotspot?.(id),
      onFocusIndex: (i) => latest.current.events.onFocusIndex?.(i),
    };
    latest.current.controller.current = { stepVisual: (v) => s.stepVisual(v), goTo: (i) => s.goTo(i) };
    setStage(s);
    return () => {
      latest.current.controller.current = null;
      s.dispose();
      engine.dispose();
      engineRef.current = null;
      entered.current = false;
      setStage(null);
      setLoaded(false);
    };
  }, []);

  // studio preset -> lighting rig + rack layout + camera
  const presetJson = JSON.stringify(p.preset);
  const overrideJson = JSON.stringify(p.lightingOverride ?? null);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !stage) return;
    const cfg = p.preset ?? FALLBACK_PRESET;
    engine.setPreset(cfg, { override: p.lightingOverride });
    engine.camera.fov = cfg.camera.fov;
    engine.camera.updateProjectionMatrix();
    stage.setLayout(cfg.rack, cfg.camera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, presetJson, overrideJson]);

  useEffect(() => stage?.setDirection(p.rtl), [stage, p.rtl]);

  // garments of the active rack (first load feeds the preloader; later switches cross-fade)
  const itemsKey = p.rackKey;
  useEffect(() => {
    if (!stage) return;
    let live = true;
    (async () => {
      if (entered.current) await stage.hide();
      if (!live) return;
      await stage.setItems(latest.current.items, (l, t) => live && latest.current.onProgress(l, t));
      if (!live) return;
      setLoaded(true);
      latest.current.onLoaded();
      if (entered.current) stage.reveal();
    })();
    return () => {
      live = false;
    };
  }, [stage, itemsKey]);

  useEffect(() => {
    if (stage && loaded && p.revealed && !entered.current) {
      entered.current = true;
      void stage.enter();
    }
  }, [stage, loaded, p.revealed]);

  // inspect <-> rack
  useEffect(() => {
    if (!stage || !loaded) return;
    if (p.inspectIndex !== null) stage.inspect(p.inspectIndex, { inset: p.inset, view: "front" });
    else if (stage.mode === "inspect") stage.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, loaded, p.inspectIndex]);

  const insetKey = `${p.inset.x.toFixed(3)},${p.inset.y.toFixed(3)}`;
  useEffect(() => {
    if (!stage) return;
    stage.setInset(p.inset);
    if (p.inspectIndex !== null) stage.reframe(p.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, insetKey]);

  useEffect(() => {
    if (stage && p.viewNonce > 0) stage.setView(p.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, p.viewNonce]);

  useEffect(() => {
    if (stage && p.look) stage.setLook(p.look.index, { colorHex: p.look.colorHex, pbr: p.look.pbr });
  }, [stage, p.look?.index, p.look?.colorHex, p.look?.pbr.roughness, p.look?.pbr.metalness, p.look?.pbr.meshTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage && p.inspectIndex !== null) stage.setHotspots(p.inspectIndex, p.selectedHotspot);
  }, [stage, p.inspectIndex, p.selectedHotspot]);

  useEffect(() => {
    if (stage && p.selectedHotspot && p.hotspotNonce > 0) stage.focusHotspot(p.selectedHotspot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, p.hotspotNonce]);

  return <div ref={host} className="absolute inset-0" role="application" aria-label="3D rack" />;
}
