// Copies three's Draco decoder to public/draco so GLTFLoader can fetch it same-origin (no CDN).
import { cpSync, mkdirSync } from "node:fs";
const src = "node_modules/three/examples/jsm/libs/draco/gltf";
mkdirSync("public/draco", { recursive: true });
cpSync(src, "public/draco", { recursive: true });
console.log("Draco decoder copied to public/draco");
