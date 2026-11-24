import * as THREE from "three";

const TEXTURE_KEYS = [
  "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap",
  "alphaMap", "bumpMap", "displacementMap", "envMap", "lightMap", "sheenColorMap", "transmissionMap",
] as const;

export function disposeMaterial(m: THREE.Material) {
  for (const k of TEXTURE_KEYS) {
    const t = (m as unknown as Record<string, unknown>)[k];
    if (t instanceof THREE.Texture) t.dispose();
  }
  m.dispose();
}

/** Deep-dispose geometries, materials and textures under `obj`, and detach it from its parent. */
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else if (mat) disposeMaterial(mat);
    (o as THREE.DirectionalLight).shadow?.map?.dispose();
  });
  obj.removeFromParent();
}
