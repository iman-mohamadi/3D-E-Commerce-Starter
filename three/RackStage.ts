import * as THREE from "three";
import gsap from "gsap";
import type { PbrConfig, ProceduralConfig, RackLayout, StudioPresetConfig, TransformConfig, Vec3 } from "../shared/schemas/json";
import type { StudioEngine } from "./engine/StudioEngine";
import { disposeObject } from "./engine/dispose";
import { HOOK_TOP, buildHanger } from "./garments/hanger";
import { loadGarment } from "./garments/loader";
import { applyVariantLook } from "./materials/pbr";
import { HANGER_Y } from "./stage/GarmentStage";

export type ViewPreset = "front" | "three-quarter" | "back";

export interface RackItem {
  id: string;
  glbUrl: string | null;
  procedural: ProceduralConfig | null;
  transform: TransformConfig;
  look: { colorHex: string; pbr: PbrConfig } | null;
  hotspots: { id: string; position: Vec3; cameraOffset: Vec3 }[];
}

export interface RackEvents {
  /** Pointer hover over a garment (screen px relative to the canvas) or null. */
  onHover?: (h: { index: number; x: number; y: number } | null) => void;
  /** Click / tap on a garment in rack view. */
  onSelect?: (index: number) => void;
  /** Click / tap on a hotspot marker in inspect view. */
  onHotspot?: (id: string) => void;
  /** The garment currently centred in the rack changed. */
  onFocusIndex?: (index: number) => void;
}

interface Entry {
  index: number;
  item: RackItem;
  root: THREE.Group; // positioned on the rail, hook height
  sway: THREE.Group; // pendulum rotation about the hook
  pivot: THREE.Group; // transform_config
  markers: THREE.Group;
  garment?: THREE.Group;
  theta: number;
  omega: number;
  fade: number;
  recede: number;
  appliedFade: number;
  appliedRecede: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const SPRING_K = 16;
const SPRING_C = 1.5;
const FADE_BASE = Symbol("fadeBase");

function ringTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(64, 64, 17, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Orchestrates many garments on one horizontal rail:
 *  - slots garments in `rack_position` order (caller passes them sorted) using each transform_config
 *  - damped, inertial horizontal navigation (wheel, drag/swipe, arrow keys) with snap-to-garment
 *  - hover raycast -> pendulum sway + screen-space label data; click -> inspect
 *  - GSAP camera moves between rack view and inspect view (front / 3/4 / back / hotspot focus)
 *  - neighbours recede + dim while one garment is inspected
 * Shares StudioEngine / loader / hanger / PBR code with the admin studio.
 */
export class RackStage {
  events: RackEvents = {};
  mode: "rack" | "inspect" = "rack";

  private readonly group = new THREE.Group();
  private railMesh?: THREE.Mesh;
  private entries: Entry[] = [];
  private rack: RackLayout = { type: "line", spacing: 1.25, railHeight: 1.85, railColor: "#2b2b30" };
  private cam: StudioPresetConfig["camera"] = { fov: 35, position: { x: 0, y: 1.35, z: 4.4 }, target: { x: 0, y: 1.05, z: 0 } };
  private dir = 1; // +1 LTR, -1 RTL: first garment sits at the start side
  private scroll = 0;
  private scrollTarget = 0;
  private scrollVel = 0;
  private lastInput = 0;
  private gestureFrom = 0;
  private dragging = false;
  private dragDist = 0;
  private dragVel = 0;
  private lastPointer = { x: 0, y: 0, t: 0 };
  private downPos = { x: 0, y: 0 };
  private pointerNdc = new THREE.Vector2(0, 0);
  private px = 0;
  private py = 0;
  private hovered = -1;
  private pickDirty = false;
  private focusIndex = -1;
  private selected = -1;
  private transition = false;
  private camTween?: gsap.core.Tween;
  private inset = { x: 0, y: 0 };
  private readonly ray = new THREE.Raycaster();
  private readonly texNormal = ringTexture("#ffffff");
  private readonly texSelected = ringTexture("#ffd27a");
  private readonly removeUpdater: () => void;
  private time = 0;
  private lastLabel = { x: -1, y: -1 };
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly engine: StudioEngine, opts: { rtl?: boolean } = {}) {
    this.dir = opts.rtl ? -1 : 1;
    this.group.name = "rack-stage";
    engine.scene.add(this.group);
    engine.controls.enabled = false;
    engine.controls.enablePan = false;
    this.removeUpdater = engine.addUpdater((dt) => this.update(dt));

    const c = engine.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onCancel);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
  }

  /* ----------------------------------------------------------------------------------------------- layout */

  setLayout(rack: RackLayout, cam: StudioPresetConfig["camera"]) {
    this.rack = rack;
    this.cam = cam;
    this.relayout();
  }

  setDirection(rtl: boolean) {
    this.dir = rtl ? -1 : 1;
    this.relayout();
  }

  private slot(i: number): { x: number; z: number; rot: number } {
    const s = this.rack.spacing;
    if (this.rack.type === "arc" && this.rack.arcRadius) {
      const R = this.rack.arcRadius;
      const a = (i * s) / R;
      return { x: this.dir * R * Math.sin(a), z: -R * (1 - Math.cos(a)), rot: -this.dir * a };
    }
    return { x: this.dir * i * s, z: 0, rot: 0 };
  }

  private relayout() {
    for (const e of this.entries) {
      const s = this.slot(e.index);
      e.root.position.set(s.x, HANGER_Y + HOOK_TOP, s.z);
      e.root.rotation.y = s.rot;
    }
    this.buildRail();
    this.engine.invalidate();
  }

  private buildRail() {
    if (this.railMesh) disposeObject(this.railMesh);
    const n = this.entries.length;
    if (n === 0) return;
    const pts: THREE.Vector3[] = [];
    for (let i = -3; i <= n + 2; i++) {
      const s = this.slot(i);
      pts.push(new THREE.Vector3(s.x, HANGER_Y + HOOK_TOP + 0.01, s.z));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), Math.max(8, pts.length * 6), 0.012, 12, false);
    this.railMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: this.rack.railColor, roughness: 0.4, metalness: 0.8 }));
    this.railMesh.name = "rack-rail";
    this.railMesh.userData.noPick = true;
    this.railMesh.castShadow = true;
    this.group.add(this.railMesh);
  }

  /* ----------------------------------------------------------------------------------------------- items */

  /** Replaces the garments. They are created hidden (fade 0); call `reveal()` / `enter()` afterwards. */
  async setItems(items: RackItem[], progress?: (loaded: number, total: number) => void): Promise<void> {
    const token = ++this.loadToken;
    this.clearEntries();
    this.scroll = this.scrollTarget = 0;
    this.focusIndex = -1;
    this.selected = -1;

    this.entries = items.map((item, index) => {
      const root = new THREE.Group();
      const sway = new THREE.Group();
      const body = new THREE.Group();
      const pivot = new THREE.Group();
      const markers = new THREE.Group();
      markers.visible = false;
      body.position.y = -HOOK_TOP; // hanger/garment origin = shoulder line
      body.add(buildHanger(), pivot);
      pivot.add(markers);
      sway.add(body);
      root.add(sway);
      root.userData.entryIndex = index;
      this.applyTransform(pivot, item.transform);
      this.group.add(root);
      return { index, item, root, sway, pivot, markers, theta: 0, omega: 0, fade: 0, recede: 0, appliedFade: -1, appliedRecede: 0 };
    });
    this.relayout();
    this.setHotspotsForAll();

    let loaded = 0;
    progress?.(0, items.length);
    await Promise.all(
      this.entries.map(async (e) => {
        const g = await loadGarment({ glbUrl: e.item.glbUrl, procedural: e.item.procedural });
        if (token !== this.loadToken) return g && disposeObject(g);
        if (g) {
          e.garment = g;
          e.pivot.add(g);
          if (e.item.look) applyVariantLook(g, e.item.look);
        }
        progress?.(++loaded, items.length);
      }),
    );
    if (token !== this.loadToken) return;
    this.applyFadeAll(true);
    this.engine.invalidate();
  }

  private applyTransform(pivot: THREE.Group, t: TransformConfig) {
    pivot.scale.setScalar(t.scale);
    pivot.position.y = t.offsetY;
    pivot.rotation.y = t.rotationY;
  }

  private clearEntries() {
    this.camTween?.kill();
    for (const e of this.entries) {
      gsap.killTweensOf(e);
      disposeObject(e.root);
    }
    this.entries = [];
    if (this.railMesh) disposeObject(this.railMesh);
    this.railMesh = undefined;
  }

  setLook(index: number, look: { colorHex: string; pbr: PbrConfig }) {
    const e = this.entries[index];
    if (!e) return;
    e.item.look = look;
    if (e.garment) applyVariantLook(e.garment, look);
    this.engine.invalidate();
  }

  setHotspots(index: number, selectedId: string | null) {
    const e = this.entries[index];
    if (!e) return;
    this.buildMarkers(e, selectedId);
  }

  private setHotspotsForAll() {
    for (const e of this.entries) this.buildMarkers(e, null);
  }

  private buildMarkers(e: Entry, selectedId: string | null) {
    for (const c of [...e.markers.children]) {
      (c as THREE.Sprite).material.dispose();
      c.removeFromParent();
    }
    for (const h of e.item.hotspots) {
      const sel = h.id === selectedId;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sel ? this.texSelected : this.texNormal, depthTest: false, transparent: true, opacity: 0.95 }));
      s.position.set(h.position.x, h.position.y, h.position.z);
      s.scale.setScalar(sel ? 0.075 : 0.06);
      s.renderOrder = 20;
      s.userData = { hotspotId: h.id, noPick: true, noVariant: true, baseScale: sel ? 0.075 : 0.06 };
      e.markers.add(s);
    }
    this.engine.invalidate();
  }

  /* ----------------------------------------------------------------------------------------------- navigation */

  get count() {
    return this.entries.length;
  }

  goTo(index: number, animate = true) {
    this.scrollTarget = clamp(index, 0, Math.max(0, this.entries.length - 1));
    if (!animate) this.scroll = this.scrollTarget;
    this.lastInput = performance.now();
    this.engine.invalidate();
  }

  /** Move one garment visually left (-1) or right (+1) — direction-aware for RTL. */
  stepVisual(v: 1 | -1) {
    if (this.mode !== "rack") return;
    this.goTo(Math.round(this.scrollTarget) + v * this.dir);
  }

  private snapTarget(): number {
    const max = Math.max(0, this.entries.length - 1);
    const d = this.scrollTarget - this.gestureFrom;
    // a small deliberate flick should still advance one garment
    const snapped = Math.abs(d) > 0.08 && Math.abs(d) < 0.5 ? this.gestureFrom + Math.sign(d) : Math.round(this.scrollTarget);
    return clamp(snapped, 0, max);
  }

  private beginGesture() {
    if (performance.now() - this.lastInput > 350) this.gestureFrom = Math.round(this.scroll);
    this.lastInput = performance.now();
  }

  private rigDistance(): number {
    const base = new THREE.Vector3(this.cam.position.x, this.cam.position.y, this.cam.position.z).distanceTo(new THREE.Vector3(this.cam.target.x, this.cam.target.y, this.cam.target.z));
    const t = Math.tan(THREE.MathUtils.degToRad(this.engine.camera.fov) / 2);
    const portrait = 2.0 / (2 * t * Math.max(0.2, this.engine.camera.aspect)); // keep ~2 garments in view on narrow screens
    return Math.min(Math.max(base, portrait), 7.5);
  }

  private rigPose(scroll = this.scroll) {
    const s = this.slot(scroll);
    const tgt = new THREE.Vector3(this.cam.target.x + s.x, this.cam.target.y, this.cam.target.z + s.z);
    const dirV = new THREE.Vector3(this.cam.position.x - this.cam.target.x, this.cam.position.y - this.cam.target.y, this.cam.position.z - this.cam.target.z).normalize();
    const pos = tgt.clone().addScaledVector(dirV, this.rigDistance());
    return { pos, tgt };
  }

  private pxPerUnit() {
    const visH = 2 * this.rigDistance() * Math.tan(THREE.MathUtils.degToRad(this.engine.camera.fov) / 2);
    return this.engine.canvas.clientHeight / visH;
  }

  /* ----------------------------------------------------------------------------------------------- pointer input */

  private pointerToNdc(e: PointerEvent | WheelEvent) {
    const r = this.engine.canvas.getBoundingClientRect();
    this.pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
    this.dragDist = 0;
    if (this.mode !== "rack" || this.transition) return;
    this.dragging = true;
    this.dragVel = 0;
    this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.beginGesture();
    this.engine.canvas.setPointerCapture(e.pointerId);
    this.engine.canvas.style.cursor = "grabbing";
  };

  private onMove = (e: PointerEvent) => {
    this.pointerToNdc(e);
    if (this.dragging) {
      const dx = e.clientX - this.lastPointer.x;
      const now = performance.now();
      const dt = Math.max(1, now - this.lastPointer.t) / 1000;
      const delta = (-this.dir * dx) / (this.pxPerUnit() * this.rack.spacing);
      this.dragDist += Math.abs(dx);
      this.scroll += delta;
      this.scrollTarget = clamp(this.scrollTarget + delta, -0.35, this.entries.length - 0.65);
      this.dragVel = this.dragVel * 0.6 + (delta / dt) * 0.4;
      this.lastPointer = { x: e.clientX, y: e.clientY, t: now };
      this.lastInput = now;
      if (this.dragDist > 6) this.setHover(-1);
    } else if (e.pointerType === "mouse" && this.mode === "rack") {
      this.pickDirty = true;
    }
    this.engine.invalidate();
  };

  private onUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    if (this.dragging) {
      this.dragging = false;
      this.engine.canvas.releasePointerCapture?.(e.pointerId);
      this.engine.canvas.style.cursor = this.hovered >= 0 ? "pointer" : "grab";
      if (moved >= 6) {
        this.scrollTarget += this.dragVel * 0.28; // inertia
        this.lastInput = performance.now();
        return;
      }
    }
    if (moved >= 6) return;
    this.pointerToNdc(e);
    if (this.mode === "rack" && !this.transition) {
      const i = this.pick();
      if (i >= 0) this.events.onSelect?.(i);
    } else if (this.mode === "inspect") {
      const id = this.pickMarker();
      if (id) this.events.onHotspot?.(id);
    }
  };

  private onCancel = () => {
    this.dragging = false;
  };

  private onLeave = () => {
    this.setHover(-1);
    this.pointerNdc.set(0, 0);
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== "rack") return;
    e.preventDefault();
    if (this.transition) return;
    this.beginGesture();
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const d = horizontal ? this.dir * e.deltaX : e.deltaY;
    this.scrollTarget = clamp(this.scrollTarget + d * 0.0042, -0.2, this.entries.length - 0.8);
    this.engine.invalidate();
  };

  /* ----------------------------------------------------------------------------------------------- picking */

  private pick(): number {
    if (!this.entries.length) return -1;
    this.ray.setFromCamera(this.pointerNdc, this.engine.camera);
    const hits = this.ray.intersectObjects(this.entries.map((e) => e.root), true);
    for (const h of hits) {
      if (h.object.userData.noPick) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.entryIndex === undefined) o = o.parent;
      if (o && this.entries[o.userData.entryIndex as number]!.fade > 0.5) return o.userData.entryIndex as number;
    }
    return -1;
  }

  private pickMarker(): string | null {
    const e = this.entries[this.selected];
    if (!e) return null;
    this.ray.setFromCamera(this.pointerNdc, this.engine.camera);
    const hit = this.ray.intersectObjects(e.markers.children, false)[0];
    return (hit?.object.userData.hotspotId as string | undefined) ?? null;
  }

  private setHover(i: number) {
    if (i === this.hovered) return;
    this.hovered = i;
    this.lastLabel = { x: -1, y: -1 };
    this.engine.canvas.style.cursor = i >= 0 ? "pointer" : this.mode === "rack" ? "grab" : "";
    const e = this.entries[i];
    if (e) {
      const p = this.screenOf(e);
      e.omega += (p.ndcX - this.pointerNdc.x >= 0 ? -1 : 1) * 1.7; // swing away from the pointer
    } else this.events.onHover?.(null);
  }

  private screenOf(e: Entry) {
    const v = new THREE.Vector3();
    e.root.getWorldPosition(v);
    v.y -= 0.12; // just below the hook
    v.project(this.engine.camera);
    const c = this.engine.canvas;
    return { ndcX: v.x, x: ((v.x + 1) / 2) * c.clientWidth, y: ((1 - v.y) / 2) * c.clientHeight };
  }

  /* ----------------------------------------------------------------------------------------------- frame update */

  private update(dt: number): boolean {
    this.time += dt;
    let animating = false;
    const n = this.entries.length;
    if (n === 0) return false;

    // --- scroll: damped follow + snap when idle
    const prev = this.scroll;
    if (!this.dragging) {
      if (this.mode === "rack" && performance.now() - this.lastInput > 150) {
        const snapped = this.snapTarget();
        if (snapped !== this.scrollTarget) this.scrollTarget = snapped;
      }
      this.scroll += (this.scrollTarget - this.scroll) * (1 - Math.exp(-dt * 7));
      if (Math.abs(this.scrollTarget - this.scroll) < 1e-4) this.scroll = this.scrollTarget;
    }
    this.scrollVel = (this.scroll - prev) / Math.max(dt, 1e-4);
    if (this.scroll !== prev) animating = true;

    const centre = clamp(Math.round(this.scroll), 0, n - 1);
    if (centre !== this.focusIndex) {
      this.focusIndex = centre;
      this.events.onFocusIndex?.(centre);
    }

    // --- pendulum physics (spring + damper about the hook)
    const camDx = this.slot(this.scroll).x - this.slot(prev).x;
    for (const e of this.entries) {
      e.omega += -camDx * 1.3;
      e.omega += (-SPRING_K * e.theta - SPRING_C * e.omega) * dt;
      e.theta = clamp(e.theta + e.omega * dt, -0.4, 0.4);
      e.sway.rotation.z = e.theta;
      if (Math.abs(e.theta) > 2e-4 || Math.abs(e.omega) > 2e-3) animating = true;
      else if (e.theta !== 0) e.theta = e.omega = 0;
    }

    // --- hover picking (once per frame)
    if (this.pickDirty && this.mode === "rack" && !this.dragging && !this.transition) {
      this.pickDirty = false;
      const i = this.pick();
      if (i !== this.hovered) this.setHover(i);
    }
    if (this.hovered >= 0 && this.mode === "rack") {
      const p = this.screenOf(this.entries[this.hovered]!);
      if (Math.abs(p.x - this.lastLabel.x) > 0.5 || Math.abs(p.y - this.lastLabel.y) > 0.5) {
        this.lastLabel = { x: p.x, y: p.y };
        this.events.onHover?.({ index: this.hovered, x: p.x, y: p.y });
      }
    }

    // --- fade / recede (entrance + inspect dimming)
    if (this.applyFadeAll()) animating = true;

    // --- rack camera rig with subtle pointer parallax
    if (this.mode === "rack" && !this.transition) {
      this.px += (this.pointerNdc.x - this.px) * (1 - Math.exp(-dt * 3));
      this.py += (this.pointerNdc.y - this.py) * (1 - Math.exp(-dt * 3));
      const { pos, tgt } = this.rigPose();
      pos.x += this.px * 0.1;
      pos.y += this.py * 0.04;
      this.setCamera(pos, tgt);
      if (Math.abs(this.pointerNdc.x - this.px) > 1e-3 || Math.abs(this.pointerNdc.y - this.py) > 1e-3) animating = true;
    }

    // --- marker pulse (inspect only)
    if (this.mode === "inspect") {
      const e = this.entries[this.selected];
      if (e) {
        for (const m of e.markers.children) m.scale.setScalar((m.userData.baseScale as number) * (1 + 0.16 * Math.sin(this.time * 3.2)));
        animating = true;
      }
    }
    return animating;
  }

  private setCamera(pos: THREE.Vector3, tgt: THREE.Vector3) {
    this.engine.camera.position.copy(pos);
    this.engine.controls.target.copy(tgt);
    this.engine.camera.lookAt(tgt);
  }

  private applyFadeAll(force = false): boolean {
    let busy = false;
    for (const e of this.entries) {
      if (e.recede !== e.appliedRecede || force) {
        const s = this.slot(e.index);
        e.root.position.z = s.z - 0.9 * e.recede;
        e.root.scale.setScalar(1 - 0.07 * e.recede);
        e.appliedRecede = e.recede;
        busy = true;
      }
      if (e.fade !== e.appliedFade || force) {
        e.root.visible = e.fade > 0.003;
        e.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m || (o as THREE.Sprite).isSprite) return;
          for (const mat of Array.isArray(m) ? m : [m]) {
            const ud = mat.userData as Record<symbol, { t: boolean; o: number } | undefined>;
            const base = (ud[FADE_BASE] ??= { t: mat.transparent, o: mat.opacity });
            mat.transparent = e.fade < 0.999 || base.t;
            mat.opacity = base.o * e.fade;
          }
        });
        e.appliedFade = e.fade;
        busy = true;
      }
    }
    return busy;
  }

  /* ----------------------------------------------------------------------------------------------- transitions */

  private camTo(pos: THREE.Vector3, tgt: THREE.Vector3, duration: number, ease = "power3.inOut", onDone?: () => void) {
    const c = this.engine.camera;
    const ctl = this.engine.controls;
    const s = { px: c.position.x, py: c.position.y, pz: c.position.z, tx: ctl.target.x, ty: ctl.target.y, tz: ctl.target.z };
    this.camTween?.kill();
    this.transition = true;
    ctl.enabled = false;
    this.camTween = gsap.to(s, {
      px: pos.x, py: pos.y, pz: pos.z, tx: tgt.x, ty: tgt.y, tz: tgt.z, duration, ease,
      onUpdate: () => {
        this.setCamera(new THREE.Vector3(s.px, s.py, s.pz), new THREE.Vector3(s.tx, s.ty, s.tz));
        this.engine.invalidate();
      },
      onComplete: () => {
        this.transition = false;
        onDone?.();
      },
    });
  }

  /** Cinematic entrance: camera glides in from distance while garments fade in from the centre outwards. */
  enter(duration = 2.6): Promise<void> {
    const { pos, tgt } = this.rigPose(0);
    const start = pos.clone().add(new THREE.Vector3(0, 0.45, 3.6));
    this.setCamera(start, tgt);
    this.reveal(0.9);
    return new Promise((resolve) => this.camTo(pos, tgt, duration, "power3.out", resolve));
  }

  /** Fade all garments in, staggered from the garment nearest the centre. */
  reveal(stagger = 0.35) {
    const n = this.entries.length;
    this.entries.forEach((e, i) => {
      gsap.killTweensOf(e, "fade");
      gsap.to(e, { fade: 1, duration: 0.9, delay: (Math.abs(i - Math.round(this.scroll)) / Math.max(1, n)) * stagger * 2, ease: "power2.out", onUpdate: () => this.engine.invalidate() });
    });
  }

  hide(duration = 0.35): Promise<void> {
    return new Promise((resolve) => {
      if (!this.entries.length) return resolve();
      this.entries.forEach((e, i) => {
        gsap.killTweensOf(e, "fade");
        gsap.to(e, { fade: 0, duration, ease: "power2.in", onUpdate: () => this.engine.invalidate(), onComplete: i === 0 ? resolve : undefined });
      });
    });
  }

  /** Smoothly bring a garment's inspect framing: neighbours recede and dim, camera glides in, orbit controls enable. */
  inspect(index: number, opts: { inset?: { x: number; y: number }; view?: ViewPreset } = {}) {
    const e = this.entries[index];
    if (!e) return;
    this.mode = "inspect";
    this.selected = index;
    this.inset = opts.inset ?? this.inset;
    this.setHover(-1);
    this.events.onHover?.(null);
    this.engine.canvas.style.cursor = "";
    this.goTo(index, true);
    for (const o of this.entries) {
      const self = o === e;
      gsap.killTweensOf(o, "recede,fade");
      gsap.to(o, { recede: self ? 0 : 1, fade: self ? 1 : 0.2, duration: 1.1, ease: "power3.inOut", onUpdate: () => this.engine.invalidate() });
    }
    e.markers.visible = true;
    this.frame(opts.view ?? "front", 1.3);
  }

  /** Back to rack browsing. */
  leave() {
    if (this.mode !== "inspect") return;
    const e = this.entries[this.selected];
    if (e) e.markers.visible = false;
    this.mode = "rack";
    this.selected = -1;
    for (const o of this.entries) {
      gsap.killTweensOf(o, "recede,fade");
      gsap.to(o, { recede: 0, fade: 1, duration: 1.0, ease: "power3.inOut", onUpdate: () => this.engine.invalidate() });
    }
    const ctl = this.engine.controls;
    ctl.enabled = false;
    const { pos, tgt } = this.rigPose();
    this.camTo(pos, tgt, 1.1, "power3.inOut", () => this.engine.invalidate());
  }

  setInset(inset: { x: number; y: number }) {
    this.inset = inset;
  }

  /** Quick camera angle for the inspected garment. */
  setView(view: ViewPreset, duration = 1.0) {
    if (this.mode === "inspect") this.frame(view, duration);
  }

  /** Re-frame the inspected garment (e.g. after the panel layout changes). */
  reframe(view: ViewPreset = "front") {
    if (this.mode === "inspect") this.frame(view, 0.8);
  }

  private shifted(pos: THREE.Vector3, tgt: THREE.Vector3) {
    const dirV = pos.clone().sub(tgt);
    const dist = dirV.length();
    const right = new THREE.Vector3(0, 1, 0).cross(dirV.clone().normalize()).normalize();
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.engine.camera.fov) / 2);
    const visW = visH * this.engine.camera.aspect;
    const shift = right.multiplyScalar(-this.inset.x * visW).add(new THREE.Vector3(0, -this.inset.y * visH, 0));
    return { pos: pos.clone().add(shift), tgt: tgt.clone().add(shift) };
  }

  private frame(view: ViewPreset, duration: number) {
    const e = this.entries[this.selected];
    if (!e) return;
    e.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(e.garment ?? e.pivot);
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(e.root.position.x, 1.1, 0), new THREE.Vector3(0.6, 0.8, 0.3));
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const cam = this.engine.camera;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const fx = Math.max(0.35, 1 - 2 * Math.abs(this.inset.x));
    const fy = Math.max(0.35, 1 - 2 * Math.abs(this.inset.y));
    const dist = Math.max(1.1, (s.y * 1.25) / (2 * t * fy), (s.x * 1.4) / (2 * t * cam.aspect * fx)) + s.z / 2;

    const az = e.root.rotation.y + e.pivot.rotation.y + (view === "back" ? Math.PI : view === "three-quarter" ? 0.72 * this.dir : 0);
    const el = view === "three-quarter" ? 0.12 : 0.05;
    const pos = c.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist));
    const f = this.shifted(pos, c);
    this.camTo(f.pos, f.tgt, duration, "power3.inOut", () => this.enableOrbit(dist));
  }

  private enableOrbit(dist: number) {
    const ctl = this.engine.controls;
    ctl.minDistance = dist * 0.45;
    ctl.maxDistance = dist * 1.8;
    ctl.enablePan = false;
    ctl.enabled = this.mode === "inspect";
    ctl.update();
  }

  /** Glide the camera to a hotspot using its stored camera_offset (garment-local position, world-space offset). */
  focusHotspot(id: string) {
    const e = this.entries[this.selected];
    const h = e?.item.hotspots.find((x) => x.id === id);
    if (!e || !h) return;
    e.root.updateWorldMatrix(true, true);
    const tgt = e.pivot.localToWorld(new THREE.Vector3(h.position.x, h.position.y, h.position.z));
    const off = new THREE.Vector3(h.cameraOffset.x, h.cameraOffset.y, h.cameraOffset.z);
    const f = this.shifted(tgt.clone().add(off), tgt);
    this.camTo(f.pos, f.tgt, 1.1, "power3.inOut", () => this.enableOrbit(off.length() + 0.4));
  }

  /* ----------------------------------------------------------------------------------------------- teardown */

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadToken++;
    this.camTween?.kill();
    this.removeUpdater();
    const c = this.engine.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onCancel);
    c.removeEventListener("pointerleave", this.onLeave);
    c.removeEventListener("wheel", this.onWheel);
    this.clearEntries();
    this.texNormal.dispose();
    this.texSelected.dispose();
    this.group.removeFromParent();
    this.engine.controls.enabled = true;
  }
}
