import * as THREE from "three";
import gsap from "gsap";
import type { PbrConfig, ProceduralConfig, RackLayout, TransformConfig, Vec3 } from "../../shared/schemas/json";
import type { StudioEngine } from "../engine/StudioEngine";
import { disposeObject } from "../engine/dispose";
import { buildHanger, buildRail } from "../garments/hanger";
import { loadGarment } from "../garments/loader";
import { applyVariantLook } from "../materials/pbr";

/** World-space height of the shoulder line / hanger. */
export const HANGER_Y = 1.5;

export interface StageHotspot {
  id: string;
  position: Vec3; // garment-local space (product_hotspots.position_3d)
}

export interface PickResult {
  /** product_hotspots.position_3d */
  position: Vec3;
  /** product_hotspots.camera_offset (camera position minus hit point, world space) */
  cameraOffset: Vec3;
}

const toVec = (v: THREE.Vector3): Vec3 => ({ x: round(v.x), y: round(v.y), z: round(v.z) });
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * One garment on a hanger inside a StudioEngine. Used by the admin Studio and (Phase 3) the storefront:
 * load GLB/procedural -> apply transform_config -> apply variant PBR -> show/pick hotspots.
 */
export class GarmentStage {
  private readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group(); // transform_config applies here
  private readonly markers = new THREE.Group();
  private hanger = buildHanger();
  private rail?: THREE.Group;
  private garment?: THREE.Group;
  private loadToken = 0;
  private look?: { colorHex: string; pbr: PbrConfig };
  private selectedId: string | null = null;
  private hotspots: StageHotspot[] = [];
  private tween?: gsap.core.Tween;
  private readonly ray = new THREE.Raycaster();

  constructor(private readonly engine: StudioEngine) {
    this.root.name = "garment-stage";
    this.root.position.y = HANGER_Y;
    this.pivot.add(this.markers);
    this.root.add(this.hanger, this.pivot);
    engine.scene.add(this.root);
  }

  setRack(rack: RackLayout) {
    if (this.rail) disposeObject(this.rail);
    this.rail = buildRail(rack);
    this.root.add(this.rail);
    this.engine.invalidate();
  }

  async load(src: { glbUrl: string | null; procedural: ProceduralConfig | null }): Promise<"glb" | "procedural" | "none"> {
    const token = ++this.loadToken;
    const g = await loadGarment(src);
    if (token !== this.loadToken) {
      if (g) disposeObject(g); // superseded by a newer load
      return "none";
    }
    if (this.garment) disposeObject(this.garment);
    this.garment = g ?? undefined;
    if (g) {
      this.pivot.add(g);
      if (this.look) applyVariantLook(g, this.look);
    }
    this.engine.invalidate();
    return !g ? "none" : g.userData.procedural ? "procedural" : "glb";
  }

  setTransform(t: TransformConfig) {
    this.pivot.scale.setScalar(t.scale);
    this.pivot.position.y = t.offsetY;
    this.pivot.rotation.y = t.rotationY;
    this.engine.invalidate();
  }

  setVariantLook(colorHex: string, pbr: PbrConfig) {
    this.look = { colorHex, pbr };
    if (this.garment) applyVariantLook(this.garment, this.look);
    this.engine.invalidate();
  }

  setHotspots(list: StageHotspot[], selectedId: string | null = null) {
    this.hotspots = list;
    this.selectedId = selectedId;
    for (const c of [...this.markers.children]) disposeObject(c);
    for (const h of list) {
      const sel = h.id === selectedId;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(sel ? 0.02 : 0.014, 16, 12),
        new THREE.MeshBasicMaterial({ color: sel ? "#ffd27a" : "#ffffff", depthTest: false, transparent: true, opacity: 0.95 }),
      );
      m.position.set(h.position.x, h.position.y, h.position.z);
      m.renderOrder = 10;
      m.userData.noPick = true;
      m.userData.noVariant = true;
      this.markers.add(m);
    }
    this.engine.invalidate();
  }

  /** Raycast the garment mesh under a pointer event. */
  pick(ev: { clientX: number; clientY: number }): PickResult | null {
    if (!this.garment) return null;
    const rect = this.engine.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.engine.camera);
    const hit = this.ray.intersectObject(this.garment, true).find((h) => !h.object.userData.noPick);
    if (!hit) return null;
    const local = this.pivot.worldToLocal(hit.point.clone());
    const offset = this.engine.camera.position.clone().sub(hit.point);
    return { position: toVec(local), cameraOffset: toVec(offset) };
  }

  /** Animate the camera to look at a hotspot (also what the storefront will do on hotspot click). */
  focus(position: Vec3, cameraOffset: Vec3, duration = 0.9) {
    const target = this.pivot.localToWorld(new THREE.Vector3(position.x, position.y, position.z));
    const cam = this.engine.camera.position;
    const controls = this.engine.controls;
    const to = { cx: target.x + cameraOffset.x, cy: target.y + cameraOffset.y, cz: target.z + cameraOffset.z, tx: target.x, ty: target.y, tz: target.z };
    this.tween?.kill();
    const state = { cx: cam.x, cy: cam.y, cz: cam.z, tx: controls.target.x, ty: controls.target.y, tz: controls.target.z };
    this.tween = gsap.to(state, {
      ...to,
      duration,
      ease: "power3.inOut",
      onUpdate: () => {
        cam.set(state.cx, state.cy, state.cz);
        controls.target.set(state.tx, state.ty, state.tz);
        controls.update();
        this.engine.invalidate();
      },
    });
  }

  dispose() {
    this.tween?.kill();
    this.loadToken++;
    disposeObject(this.root);
    this.garment = undefined;
  }
}
