// Pass artwork: the Cycles 'pass' render (blender/scripts/06_render.py) -> public/pass/bust.webp
// (1080x1350, transparent, drawn over the title on each visitor's ENCLAVE pass; bump the ?v= in
// components/register/drawPass.js when it changes).
// The red rim is added here, traced from the render's alpha silhouette like the web shader's
// screen-space rim: a thin hot line just inside the outer contour, a little stronger on top, and
// a faint bloom outside. It never touches inner folds (ears, nostrils, lips).
// The social renders (enclave_poster / enclave_hero) get the same rim in blender/renders/social/.
// Usage: npm run pass-art
import sharp from "sharp";
import { existsSync, mkdirSync, statSync } from "node:fs";

const RENDERS = "blender/renders";
const OUT = "public/pass/bust.webp";

// three box passes ~ a gaussian of the given sigma; edges clamp, so where the figure runs off the
// frame (the cropped chest and shoulders) there is no contour and no rim
function blur(src, W, H, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt(sigma * sigma + 0.25) - 0.5));
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  const pass = (from, to, n, len, stride, step) => {
    for (let k = 0; k < n; k++) {
      const base = k * stride;
      const at = (i) => from[base + Math.min(len - 1, Math.max(0, i)) * step];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < len; i++) {
        to[base + i * step] = sum / (2 * r + 1);
        sum += at(i + r + 1) - at(i - r);
      }
    }
  };
  for (let it = 0; it < 3; it++) {
    pass(a, b, H, W, W, 1); // rows
    pass(b, a, W, H, 1, W); // columns
  }
  return a;
}

const sat = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

// fade = [from, to] as fractions of the height: the bust dissolves into the dark toward the bottom,
// like the web hero, instead of showing its flat cut (and the rim tracing it).
// outline: drop the render's shading, leaving a flat black silhouette carrying only the rim.
async function withRim(src, width, height, fade = null, outline = false) {
  const { data } = await sharp(src).resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = width, H = height, N = W * H;
  const k = W / 1080; // radii are tuned at pass size
  const A = new Float32Array(N);
  for (let i = 0; i < N; i++) A[i] = data[i * 4 + 3] / 255;
  const bCore = blur(A, W, H, 1.6 * k);
  const bNear = blur(A, W, H, 5 * k);
  const core = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // outward normal from the soft silhouette; the rim leans toward the top, like the idle web rim
      const gx = bNear[y * W + Math.min(W - 1, x + 1)] - bNear[y * W + Math.max(0, x - 1)];
      const gy = bNear[Math.min(H - 1, y + 1) * W + x] - bNear[Math.max(0, y - 1) * W + x];
      const gl = Math.hypot(gx, gy) || 1;
      const up = sat(gy / gl); // outward normal is -grad; image up is -y, so dot = gy / |g|
      const w = 0.7 + 0.3 * (0.25 + 1.5 * up);
      const c = A[i] * smooth(sat((1 - bCore[i]) * 2.4));
      const n = A[i] * sat((1 - bNear[i]) * 2) * 0.3;
      core[i] = (c + n) * w;
    }
  }
  const glow = blur(core, W, H, 4 * k);
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const a = A[i], rim = core[i];
    // the rim on the figure: red, running hot (toward coral) in the thinnest core
    const base = outline ? [5, 5, 6] : [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    let r = base[0] + rim * 255;
    let g = base[1] + rim * 62 + rim * rim * rim * 70;
    let b = base[2] + rim * 34 + rim * rim * rim * 48;
    // faint bloom outside the silhouette, composited under the figure
    const ga = sat(glow[i] * 0.55) * (1 - a);
    const oa = a + ga;
    if (oa > 0) {
      r = (Math.min(255, r) * a + 255 * ga) / oa;
      g = (Math.min(255, g) * a + 58 * ga) / oa;
      b = (Math.min(255, b) * a + 34 * ga) / oa;
    }
    out[i * 4] = Math.min(255, r);
    out[i * 4 + 1] = Math.min(255, g);
    out[i * 4 + 2] = Math.min(255, b);
    const f = fade ? 1 - smooth(sat((Math.floor(i / W) / H - fade[0]) / (fade[1] - fade[0]))) : 1;
    out[i * 4 + 3] = Math.round(sat(oa) * f * 255);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } });
}

// trying another render for the pass: `npm run pass-art -- --in <render.png> --out <art.webp>
// [--outline]` writes only that (public/ and the social renders stay as they are)
const flag = (name) => process.argv.indexOf(`--${name}`);
if (flag("in") > 0) {
  const out = process.argv[flag("out") + 1];
  await (await withRim(process.argv[flag("in") + 1], 1080, 1350, null, flag("outline") > 0)).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(out);
  console.log(`${out} ${Math.round(statSync(out).size / 1024)} KB`);
  process.exit(0);
}

mkdirSync("public/pass", { recursive: true });
await (await withRim(`${RENDERS}/enclave_pass.png`, 1080, 1350)).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(OUT);
console.log(`${OUT} ${Math.round(statSync(OUT).size / 1024)} KB`);

for (const name of ["poster", "hero"]) {
  const src = `${RENDERS}/enclave_${name}.png`;
  if (!existsSync(src)) continue;
  const { width, height } = await sharp(src).metadata();
  mkdirSync(`${RENDERS}/social`, { recursive: true });
  const dst = `${RENDERS}/social/enclave_${name}.png`;
  await (await withRim(src, width, height, [0.7, 0.9])).png().toFile(dst);
  console.log(dst);
}

// the figure for the link-preview image (app/opengraph-image.jsx), which can't read webp
const OG = "public/pass/og-bust.png";
if (existsSync(`${RENDERS}/social/enclave_hero.png`)) {
  await sharp(`${RENDERS}/social/enclave_hero.png`).resize({ height: 640 }).png({ compressionLevel: 9, palette: false }).toFile(OG);
  console.log(`${OG} ${Math.round(statSync(OG).size / 1024)} KB`);
}
