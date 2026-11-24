import * as THREE from "three";
import type { RackLayout } from "../../shared/schemas/json";

export const HOOK_TOP = 0.172;

/** Standard rack hanger. Origin = shoulder line (garment y=0); hook rises ~0.17m above it. */
export function buildHanger(): THREE.Group {
  const g = new THREE.Group();
  g.name = "hanger";
  const mat = new THREE.MeshStandardMaterial({ color: "#b9b2a6", roughness: 0.3, metalness: 0.9 });

  // two shoulder arms sloping down from the neck
  const reach = 0.27;
  const drop = 0.045;
  const slope = Math.atan2(drop, reach);
  for (const side of [-1, 1]) {
    const len = Math.hypot(reach, drop);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 10), mat);
    arm.rotation.z = Math.PI / 2 - side * slope; // descends away from the neck
    arm.position.set((side * reach) / 2, 0.04 - drop / 2, 0); // midpoint of neck (y=0.04) -> tip (y=0.04-drop)
    g.add(arm);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 10), mat);
  neck.position.y = 0.075;
  g.add(neck);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 10, 24, Math.PI * 1.35), mat);
  hook.position.set(0, 0.138, 0);
  hook.rotation.z = Math.PI * 0.2;
  g.add(hook);

  g.traverse((o) => {
    o.userData.noVariant = true;
    o.userData.noPick = true;
    (o as THREE.Mesh).castShadow = true;
  });
  return g;
}

/** Horizontal rail segment above the hanger, styled by the preset's rack layout. */
export function buildRail(rack: RackLayout): THREE.Group {
  const g = new THREE.Group();
  g.name = "rail";
  const mat = new THREE.MeshStandardMaterial({ color: rack.railColor, roughness: 0.4, metalness: 0.8 });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Math.max(1.6, rack.spacing * 3), 16), mat);
  rail.rotation.z = Math.PI / 2;
  rail.position.y = HOOK_TOP + 0.01;
  g.add(rail);
  g.traverse((o) => {
    o.userData.noVariant = true;
    o.userData.noPick = true;
  });
  return g;
}
