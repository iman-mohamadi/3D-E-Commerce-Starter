import { studioPresetConfig, type StudioPresetConfig } from "../../shared/schemas/json";

/** Neutral rig used only when the database has no studio preset at all (never for normal operation). */
export const FALLBACK_PRESET: StudioPresetConfig = studioPresetConfig.parse({
  lighting: {
    background: "#101012",
    ambient: { color: "#9aa0b0", intensity: 0.4 },
    key: { color: "#ffffff", intensity: 2.2, position: { x: 2.5, y: 4, z: 3 }, castShadow: true },
    fill: { color: "#a0a8ff", intensity: 0.5, position: { x: -3, y: 2, z: 2 } },
    floor: { color: "#16161a", roughness: 0.5, metalness: 0.1, reflective: false },
  },
});
