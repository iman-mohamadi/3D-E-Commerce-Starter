import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LightingConfig, StudioPresetConfig } from "../../shared/schemas/json";
import { applyStudioPreset, type PresetHandle } from "./lighting";

export const MAX_DPR = 2;

/** True when the browser can create a WebGL2/WebGL context. */
export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface EngineOptions {
  resolveUrl?: (keyOrUrl: string) => string;
  onContextLost?: () => void;
}

/**
 * Scene + renderer manager shared by the admin 3D Studio and the storefront.
 *  - DPR clamped to min(devicePixelRatio, 2)
 *  - renders on demand (dirty flag) and pauses when off-screen / tab hidden
 *  - `dispose()` releases GPU resources, observers, listeners and the canvas
 * Use `StudioEngine.create()`; it returns null when WebGL is unavailable so callers can show a fallback image.
 */
export class StudioEngine {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;

  private preset?: PresetHandle;
  private raf = 0;
  private dirty = true;
  private visible = true;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersection: IntersectionObserver;
  private readonly updaters = new Set<(dt: number) => boolean | void>();
  private last = performance.now();

  private constructor(readonly container: HTMLElement, private readonly opts: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.canvas);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener("change", this.invalidate);

    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver(([e]) => {
      this.visible = !!e?.isIntersecting;
      if (this.visible) this.invalidate();
    });
    this.intersection.observe(container);
    document.addEventListener("visibilitychange", this.invalidate);

    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  static create(container: HTMLElement, opts: EngineOptions = {}): StudioEngine | null {
    if (typeof window === "undefined" || !isWebGLAvailable()) return null;
    try {
      return new StudioEngine(container, opts);
    } catch (e) {
      console.warn("[three] renderer init failed", e);
      return null;
    }
  }

  readonly invalidate = () => {
    this.dirty = true;
  };

  /** Register a per-frame callback; return true from it to request another frame (animations). */
  addUpdater(fn: (dt: number) => boolean | void) {
    this.updaters.add(fn);
    this.invalidate();
    return () => this.updaters.delete(fn);
  }

  /** Swap the active `studio_presets` rig; optionally reposition the camera from the preset. */
  setPreset(config: StudioPresetConfig, o: { resetCamera?: boolean; override?: Partial<LightingConfig> } = {}) {
    this.preset?.dispose();
    this.preset = applyStudioPreset(this.scene, this.renderer, config, { resolveUrl: this.opts.resolveUrl, override: o.override });
    if (o.resetCamera) {
      const c = config.camera;
      this.camera.fov = c.fov;
      this.camera.position.set(c.position.x, c.position.y, c.position.z);
      this.controls.target.set(c.target.x, c.target.y, c.target.z);
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }
    this.invalidate();
  }

  private resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.opts.onContextLost?.();
  };

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let animating = this.controls.update();
    for (const u of this.updaters) if (u(dt)) animating = true;
    if (this.dirty || animating) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersection.disconnect();
    document.removeEventListener("visibilitychange", this.invalidate);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.dispose();
    this.preset?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.updaters.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
