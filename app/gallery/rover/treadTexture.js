// The rover's track belt, drawn on canvas (ported from NTC event 2, src/scene/textures.js): the GLB
// keeps the belt's material plain so each belt can scroll its own copy of these.
import * as THREE from "three";

const cache = new Map();
function canvasTex(key, size, draw, { srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** one track link, drawn as a height map (white = raised): a chevron lug, a guide horn in the middle,
 * a hinge groove at the link's end. The colour and the normal map both come from it. */
function drawTreadHeight(g, s) {
  g.fillStyle = "#000";
  g.fillRect(0, 0, s, s);
  // hinge groove between links
  g.fillRect(0, s * 0.93, s, s * 0.07);
  // chevron lug
  g.strokeStyle = "#fff";
  g.lineWidth = s * 0.15;
  g.lineCap = "butt";
  g.lineJoin = "miter";
  g.beginPath();
  g.moveTo(s * 0.04, s * 0.22);
  g.lineTo(s * 0.5, s * 0.56);
  g.lineTo(s * 0.96, s * 0.22);
  g.stroke();
  // centre guide horn, a little lower than the lug
  g.fillStyle = "#9a9a9a";
  g.fillRect(s * 0.44, s * 0.66, s * 0.12, s * 0.2);
}

function heights(s) {
  const h = document.createElement("canvas");
  h.width = h.height = s;
  drawTreadHeight(h.getContext("2d"), s);
  return h.getContext("2d").getImageData(0, 0, s, s).data;
}

/** rubber track with chevron lugs; tiles along the belt and scrolls as the rover drives */
export const treadTexture = () =>
  canvasTex("tread", 128, (g, s) => {
    const hd = heights(s);
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const k = hd[i * 4] / 255;
      const y = Math.floor(i / s);
      const grain = (Math.random() - 0.5) * 6;
      // rubber: dark grooves, worn lighter lug tops; the guide horn reads as dull metal
      const metal = k > 0.5 && k < 0.7;
      const v = metal ? 74 : 16 + k * 30 + (y < s * 0.06 ? 4 : 0);
      img.data[i * 4] = v + grain + (metal ? 2 : 1);
      img.data[i * 4 + 1] = v + grain;
      img.data[i * 4 + 2] = v + grain - (metal ? 0 : 1);
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });

/** the matching normal map (tangent space, from the same height map) */
export const treadNormalTexture = () =>
  canvasTex(
    "tread-normal",
    128,
    (g, s) => {
      const hd = heights(s);
      const at = (x, y) => hd[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
      const img = g.createImageData(s, s);
      const k = 2.2;
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) * k;
          const dy = (at(x, y + 1) - at(x, y - 1)) * k;
          const len = Math.hypot(dx, dy, 1);
          const i = (y * s + x) * 4;
          img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
          img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
          img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
          img.data[i + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    { srgb: false }
  );
