import * as THREE from "three";
import type { PbrConfig } from "../../shared/schemas/json";

export interface VariantLook {
  colorHex: string;
  pbr: PbrConfig;
}

function matches(name: string, target: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  const t = target.toLowerCase();
  if (t === "*" || t === "all") return true;
  if (t.endsWith("*")) return n.startsWith(t.slice(0, -1));
  // "body" also matches "body_sleeve_l" etc. (procedural + typical GLB naming)
  return n === t || n.startsWith(`${t}_`) || n.startsWith(`${t}.`);
}

function ownMaterial(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const out = list.map((m) => {
    if (!m.userData.owned) {
      const c = m.clone();
      c.userData.owned = true;
      return c;
    }
    return m;
  });
  mesh.material = Array.isArray(mesh.material) ? out : out[0]!;
  return out.filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial);
}

/**
 * Applies `product_variants.color_hex` + `pbr_config` to the meshes matched by `meshTarget`
 * (mesh name or material name). Materials are cloned once per mesh so shared GLB materials aren't mutated.
 * If nothing matches (GLB naming differs) the look is applied to every mesh, so the preview never looks broken.
 * Returns how many meshes matched `meshTarget` directly.
 */
export function applyVariantLook(root: THREE.Object3D, look: VariantLook): number {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.noVariant) meshes.push(o as THREE.Mesh);
  });

  const direct = meshes.filter((m) => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    return matches(m.name, look.pbr.meshTarget) || mats.some((x) => matches(x.name, look.pbr.meshTarget));
  });
  const targets = direct.length ? direct : meshes;

  for (const mesh of targets) {
    for (const mat of ownMaterial(mesh)) {
      mat.color.set(look.colorHex);
      mat.roughness = look.pbr.roughness;
      mat.metalness = look.pbr.metalness;
      mat.needsUpdate = true;
    }
  }
  return direct.length;
}
