import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import type { LightingConfig, StudioPresetConfig } from "../../shared/schemas/json";
import { disposeObject } from "./dispose";

export interface PresetHandle {
  dispose(): void;
}

export interface ApplyPresetOptions {
  /** Maps a storage key / URL to a fetchable URL (storage().publicUrl on the server side). */
  resolveUrl?: (keyOrUrl: string) => string;
  /** Partial lighting override (store_settings.lighting_config) merged over the preset. */
  override?: Partial<LightingConfig>;
}

function addLight<T extends THREE.DirectionalLight | THREE.SpotLight>(group: THREE.Group, l: LightingConfig["key"], make: () => T): T {
  const light = make();
  light.color.set(l.color);
  light.intensity = l.intensity;
  if (l.position) light.position.set(l.position.x, l.position.y, l.position.z);
  light.castShadow = !!l.castShadow;
  if (light.castShadow && light.shadow) {
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
  }
  group.add(light);
  return light;
}

/**
 * Builds the studio rig (background, fog, exposure, lights, floor, env map) from a `studio_presets` record.
 * Everything created is tracked by the returned handle so switching presets leaks nothing.
 */
export function applyStudioPreset(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  config: StudioPresetConfig,
  opts: ApplyPresetOptions = {},
): PresetHandle {
  const L: LightingConfig = { ...config.lighting, ...(opts.override ?? {}) } as LightingConfig;
  const group = new THREE.Group();
  group.name = "studio-rig";
  scene.add(group);

  scene.background = new THREE.Color(L.background);
  scene.fog = L.fog ? new THREE.Fog(L.fog.color, L.fog.near, L.fog.far) : null;
  renderer.toneMappingExposure = L.toneMappingExposure;

  group.add(new THREE.AmbientLight(L.ambient.color, L.ambient.intensity));
  addLight(group, L.key, () => new THREE.DirectionalLight());
  if (L.fill) addLight(group, L.fill, () => new THREE.DirectionalLight());
  if (L.rim) addLight(group, L.rim, () => new THREE.DirectionalLight());
  for (const s of L.spots ?? []) {
    const spot = addLight(group, s, () => new THREE.SpotLight());
    spot.angle = s.angle ?? 0.5;
    spot.penumbra = s.penumbra ?? 0.6;
    spot.decay = 2;
    const t = s.target ?? { x: 0, y: 1, z: 0 };
    spot.target.position.set(t.x, t.y, t.z);
    group.add(spot.target);
  }

  if (L.floor) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshStandardMaterial({ color: L.floor.color, roughness: L.floor.roughness, metalness: L.floor.metalness }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "studio-floor";
    group.add(floor);
  }

  let envTexture: THREE.Texture | null = null;
  let cancelled = false;
  scene.environment = null;
  scene.environmentIntensity = L.environmentIntensity;
  if (L.environmentMap) {
    const url = opts.resolveUrl ? opts.resolveUrl(L.environmentMap) : L.environmentMap;
    const loader = url.toLowerCase().endsWith(".exr") ? new EXRLoader() : new RGBELoader();
    loader.load(
      url,
      (tex) => {
        if (cancelled) return tex.dispose();
        const pmrem = new THREE.PMREMGenerator(renderer);
        envTexture = pmrem.fromEquirectangular(tex).texture;
        tex.dispose();
        pmrem.dispose();
        scene.environment = envTexture;
      },
      undefined,
      (err) => console.warn("[three] environment map failed to load", err),
    );
  }

  return {
    dispose() {
      cancelled = true;
      disposeObject(group);
      envTexture?.dispose();
      if (scene.environment === envTexture) scene.environment = null;
    },
  };
}
