import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ProceduralConfig } from "../../shared/schemas/json";
import { disposeObject } from "../engine/dispose";
import { buildProceduralGarment } from "./procedural";

export interface GarmentSource {
  /** Resolved, fetchable GLB URL (null -> procedural fallback). */
  glbUrl: string | null;
  procedural: ProceduralConfig | null;
}

let draco: DRACOLoader | undefined;
let gltf: GLTFLoader | undefined;

export const DRACO_DECODER_PATH = "/draco/";

function loader() {
  if (!gltf) {
    draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
    gltf = new GLTFLoader().setDRACOLoader(draco);
  }
  return gltf;
}

/** Releases the shared Draco worker pool. Call when the last 3D view unmounts (optional). */
export function disposeLoaders() {
  draco?.dispose();
  draco = undefined;
  gltf = undefined;
}

/** Re-anchor so the top of the bounding box sits at y=0 and the model is centred on x/z (hanger-friendly). */
function anchorToShoulders(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.max.y;
}

async function loadGlb(url: string): Promise<THREE.Group> {
  const res = await loader().loadAsync(url);
  const inner = res.scene;
  inner.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  anchorToShoulders(inner);
  const g = new THREE.Group();
  g.name = "glb-garment";
  g.add(inner);
  return g;
}

/**
 * Loads a garment: the uploaded `.glb` (Draco supported) when present; if it's missing or fails to load,
 * the procedural builder driven by `products.procedural_config`. Returns null if neither is available.
 */
export async function loadGarment(src: GarmentSource): Promise<THREE.Group | null> {
  if (src.glbUrl) {
    try {
      return await loadGlb(src.glbUrl);
    } catch (e) {
      console.warn("[three] GLB failed to load, using procedural fallback", e);
    }
  }
  return src.procedural ? buildProceduralGarment(src.procedural) : null;
}

export { disposeObject };
