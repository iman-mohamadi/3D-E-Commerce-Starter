import * as THREE from "three";
import type { ProceduralConfig } from "../../shared/schemas/json";

type Kind = ProceduralConfig["kind"];

/** Default numeric params (metres) per garment kind. Admin forms render inputs from these keys. */
export const PROCEDURAL_DEFAULTS: Record<Kind, Record<string, number>> = {
  tee: { width: 0.58, length: 0.72, sleeveLength: 0.22, neck: 0.09, boxiness: 1.1 },
  shirt: { width: 0.56, length: 0.76, sleeveLength: 0.55, neck: 0.08, boxiness: 1 },
  hoodie: { width: 0.64, length: 0.7, sleeveLength: 0.58, hoodHeight: 0.28, boxiness: 1.1 },
  coat: { width: 0.66, length: 1.1, sleeveLength: 0.62, lapel: 0.13, boxiness: 1 },
  dress: { width: 0.5, length: 1.05, sleeveLength: 0, neck: 0.09, boxiness: 0.9 },
  trousers: { waist: 0.38, length: 1.0, legWidth: 0.2, taper: 0.8, pocketDepth: 0.04 },
  custom: { width: 0.58, length: 0.72, sleeveLength: 0.22, neck: 0.09, boxiness: 1.1 },
};

/** Mesh naming: fabric shell = "body*" (targeted by pbr_config.meshTarget "body"); accents = "trim*". */
const TRIM_COLOR = "#1b1b1f";

function shell(color = "#808080") {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
}
function trimMat() {
  return new THREE.MeshStandardMaterial({ color: TRIM_COLOR, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
}

function mesh(name: string, geo: THREE.BufferGeometry, mat: THREE.Material) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Elliptical tube hanging down from y=0. rTop/rBottom are X radii; depth scales Z. */
function tube(name: string, rTop: number, rBottom: number, height: number, depth: number, mat: THREE.Material) {
  const m = mesh(name, new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true), mat);
  m.scale.z = depth;
  m.position.y = -height / 2;
  return m;
}

function sleeves(g: THREE.Group, p: Record<string, number>, shoulderX: number, rTop: number, mat: THREE.Material) {
  const len = p.sleeveLength ?? 0;
  if (len <= 0.01) return;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * shoulderX, -0.035, 0);
    arm.rotation.z = side * 0.28; // hang slightly outwards
    const rBottom = rTop * (len > 0.4 ? 0.78 : 0.95);
    const s = mesh(`body_sleeve_${side < 0 ? "l" : "r"}`, new THREE.CylinderGeometry(rTop, rBottom, len, 24, 1, true), mat);
    s.position.y = -len / 2;
    s.scale.z = 0.9;
    arm.add(s);
    if (len > 0.4) {
      const cuff = mesh(`trim_cuff_${side < 0 ? "l" : "r"}`, new THREE.CylinderGeometry(rBottom * 1.02, rBottom * 1.02, 0.045, 24, 1, true), trimMat());
      cuff.position.y = -len + 0.02;
      cuff.scale.z = 0.9;
      arm.add(cuff);
    }
    g.add(arm);
  }
}

function yoke(w: number, depth: number, mat: THREE.Material) {
  // rounded shoulder cap that closes the top of the torso tube
  const m = mesh("body_yoke", new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.scale.set((w / 2) * 0.98, 0.06, (w / 2) * depth * 0.98);
  return m;
}

function buildTop(kind: "tee" | "hoodie" | "coat", p: Record<string, number>): THREE.Group {
  const g = new THREE.Group();
  const mat = shell();
  const w = p.width ?? 0.6;
  const len = p.length ?? 0.7;
  const box = p.boxiness ?? 1;
  const depth = 0.52;
  const rTop = (w / 2) * 0.96;
  const rBottom = (w / 2) * box * (kind === "coat" ? 1.12 : 1);

  g.add(tube("body_torso", rTop, rBottom, len, depth, mat));
  g.add(yoke(w, depth, mat));
  sleeves(g, p, (w / 2) * 0.97, kind === "coat" ? 0.075 : 0.085, mat);

  if (kind === "tee") {
    const neck = mesh("trim_collar", new THREE.TorusGeometry(p.neck ?? 0.09, 0.012, 10, 32), trimMat());
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, 0.058, 0.01);
    g.add(neck);
  }

  if (kind === "hoodie") {
    const hh = p.hoodHeight ?? 0.28;
    const hood = mesh("body_hood", new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.78), mat);
    hood.scale.set(0.15, hh * 0.55, 0.15);
    hood.position.set(0, 0.04 - hh * 0.1, -0.09);
    g.add(hood);
    const pocket = mesh("body_pocket", new THREE.BoxGeometry(w * 0.55, len * 0.22, 0.02), mat);
    pocket.position.set(0, -len * 0.7, (w / 2) * depth * 0.98);
    g.add(pocket);
    for (const x of [-0.03, 0.03]) {
      const cord = mesh("trim_cord", new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8), trimMat());
      cord.position.set(x, -0.12, (w / 2) * depth * 0.98 + 0.01);
      g.add(cord);
    }
  }

  if (kind === "coat") {
    const lapel = p.lapel ?? 0.13;
    for (const side of [-1, 1]) {
      const l = mesh("body_lapel", new THREE.BoxGeometry(lapel, len * 0.38, 0.012), mat);
      l.position.set(side * lapel * 0.55, -len * 0.19, (w / 2) * depth + 0.01);
      l.rotation.z = side * -0.18;
      g.add(l);
    }
    for (let i = 0; i < 3; i++) {
      const b = mesh("trim_button", new THREE.CylinderGeometry(0.013, 0.013, 0.008, 16), trimMat());
      b.rotation.x = Math.PI / 2;
      b.position.set(0, -0.18 - i * 0.13, (w / 2) * depth * 1.04);
      g.add(b);
    }
  }
  return g;
}

function buildTrousers(p: Record<string, number>): THREE.Group {
  const g = new THREE.Group();
  const mat = shell();
  const waist = p.waist ?? 0.38;
  const len = p.length ?? 1;
  const rTop = waist / 4 + 0.02;
  const rBottom = ((p.legWidth ?? 0.2) / 2) * (p.taper ?? 0.8);
  const legs = THREE.MathUtils.clamp(len, 0.4, 1.4);

  for (const side of [-1, 1]) {
    const leg = tube(`body_leg_${side < 0 ? "l" : "r"}`, rTop, rBottom, legs - 0.04, 0.82, mat);
    leg.position.set(side * (waist / 4 - 0.005), -0.04 - (legs - 0.04) / 2, 0);
    g.add(leg);
    const pocket = mesh("body_pocket", new THREE.BoxGeometry(0.085, 0.13, p.pocketDepth ?? 0.04), mat);
    pocket.position.set(side * (waist / 4 + rTop * 0.55), -0.04 - legs * 0.38, rTop * 0.82 + 0.015);
    g.add(pocket);
  }
  const band = mesh("trim_waistband", new THREE.CylinderGeometry(waist / 2.05, waist / 2.05, 0.045, 40, 1, true), trimMat());
  band.scale.z = 0.62;
  band.position.y = -0.02;
  g.add(band);
  return g;
}

/** Builds a procedural garment hanging from y = 0 (shoulder line / waistband). */
export function buildProceduralGarment(cfg: ProceduralConfig): THREE.Group {
  const params = { ...PROCEDURAL_DEFAULTS[cfg.kind], ...cfg.params };
  let g: THREE.Group;
  switch (cfg.kind) {
    case "trousers":
      g = buildTrousers(params);
      break;
    case "hoodie":
      g = buildTop("hoodie", params);
      break;
    case "coat":
    case "dress":
      g = buildTop("coat", params);
      break;
    default:
      g = buildTop("tee", params);
  }
  g.name = `procedural-${cfg.kind}`;
  g.userData.procedural = true;
  return g;
}
