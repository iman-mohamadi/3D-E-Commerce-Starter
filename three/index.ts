export { StudioEngine, isWebGLAvailable, MAX_DPR } from "./engine/StudioEngine";
export { applyStudioPreset } from "./engine/lighting";
export { disposeObject } from "./engine/dispose";
export { GarmentStage, HANGER_Y, type PickResult, type StageHotspot } from "./stage/GarmentStage";
export { loadGarment, disposeLoaders, type GarmentSource } from "./garments/loader";
export { buildProceduralGarment, PROCEDURAL_DEFAULTS } from "./garments/procedural";
export { buildHanger, buildRail } from "./garments/hanger";
export { applyVariantLook } from "./materials/pbr";
