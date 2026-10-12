// Hero 3D assets. They are served with immutable caching (next.config.mjs), so bump ASSET_V
// whenever the Blender pipeline / npm run model / npm run textures re-exports them.
export const ASSET_V = "6";

const v = (path) => `${path}?v=${ASSET_V}`;

export const MODEL_URL = v("/models/enclave-bust.glb");

// first load (about 2 MB with the model)
export const TEXTURES = {
  normal: v("/textures/bust_normal_2k.webp"),
  orm: v("/textures/bust_orm_1k.webp"),
  data: v("/textures/bust_data_1k.webp"),
  detail: v("/textures/detail_normal.webp"),
};

// progressive upgrade on capable desktops
export const TEXTURES_HI = {
  normal: v("/textures/bust_normal_4k.webp"),
  orm: v("/textures/bust_orm_2k.webp"),
};
