import * as THREE from "three";
import { imageOptimizerUrl, THUMB_QUALITY } from "../EnclaveLightbox";

// Photo textures for the spiral, loaded only around the focused card. The thumbs use the same
// optimizer URL the grid warms (640w at q55), so on the live site they come out of the image
// cache. The focused card and its neighbours swap in a sharper copy once scrolling settles.
// Uploads to the GPU are spread over frames so a burst of decoded images never stalls one.

const SHARP_W = 1080;
const SHARP_Q = 72;
const MAX_LOADING = 4;
const UPLOADS_PER_FRAME = 2;
const SHARP_BUDGET = 5;

export function createTextureStore({ photos, phone, onLoad }) {
  const baseW = phone ? 384 : 640;
  const budget = phone ? 36 : 48;
  const base = new Map(); // index -> { img, tex, ready, uploaded }
  const sharp = new Map();
  const uploads = [];
  let loading = 0;
  let anisotropy = 4;

  const start = (map, i, width, quality) => {
    const photo = photos[i];
    if (!photo) return;
    const entry = { img: new window.Image(), tex: null, ready: false, uploaded: false, dead: false };
    map.set(i, entry);
    loading += 1;
    entry.img.decoding = "async";
    entry.img.src = imageOptimizerUrl(photo.src, width, quality);
    entry.img
      .decode()
      .then(() => {
        if (entry.dead) return;
        const tex = new THREE.Texture(entry.img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = anisotropy;
        tex.needsUpdate = true;
        entry.tex = tex;
        entry.ready = true;
        uploads.push(entry);
        onLoad?.();
      })
      .catch(() => {
        // a failed thumb stays a dark plate; try again the next time it comes into view
        if (!entry.dead) map.delete(i);
      })
      .finally(() => {
        loading -= 1;
      });
  };

  const drop = (map, i) => {
    const entry = map.get(i);
    if (!entry) return;
    entry.dead = true;
    if (!entry.ready) entry.img.src = "";
    entry.tex?.dispose();
    map.delete(i);
  };

  return {
    setAnisotropy(value) {
      anisotropy = value;
    },

    /**
     * order: indexes wanted, nearest to focus first. fast: scrolling hard, so start nothing
     * new. settled: focus has been still for a moment, so sharpen around it.
     */
    want(order, focus, { fast, settled }) {
      const wanted = new Set(order);
      if (!fast) {
        for (const i of order) {
          if (loading >= MAX_LOADING) break;
          if (!base.has(i)) start(base, i, baseW, THUMB_QUALITY);
        }
      }
      // over budget: forget the ones furthest from focus that are no longer wanted
      if (base.size > budget) {
        const spare = [...base.keys()].filter((i) => !wanted.has(i));
        spare.sort((a, b) => Math.abs(b - focus) - Math.abs(a - focus));
        for (const i of spare.slice(0, base.size - budget)) drop(base, i);
      }
      if (settled && !phone) {
        for (const i of [focus, focus + 1, focus - 1]) {
          if (loading >= MAX_LOADING) break;
          if (i >= 0 && i < photos.length && !sharp.has(i) && base.get(i)?.uploaded) {
            start(sharp, i, SHARP_W, SHARP_Q);
          }
        }
      }
      if (sharp.size > SHARP_BUDGET) {
        const far = [...sharp.keys()].sort((a, b) => Math.abs(b - focus) - Math.abs(a - focus));
        for (const i of far.slice(0, sharp.size - SHARP_BUDGET)) drop(sharp, i);
      }
    },

    /** Push a couple of decoded images to the GPU. Returns true if any arrived. */
    upload(gl) {
      let done = 0;
      while (uploads.length && done < UPLOADS_PER_FRAME) {
        const entry = uploads.shift();
        if (entry.dead) continue;
        gl.initTexture(entry.tex);
        entry.uploaded = true;
        done += 1;
      }
      return done > 0;
    },

    /** The best uploaded texture for a card, or null. */
    get(i) {
      const s = sharp.get(i);
      if (s?.uploaded) return s.tex;
      const b = base.get(i);
      return b?.uploaded ? b.tex : null;
    },

    loadedCount() {
      let n = 0;
      for (const entry of base.values()) if (entry.uploaded) n += 1;
      return n;
    },

    dispose() {
      for (const i of [...base.keys()]) drop(base, i);
      for (const i of [...sharp.keys()]) drop(sharp, i);
      uploads.length = 0;
    },
  };
}
