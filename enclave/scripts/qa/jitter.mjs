// Jitter (not motion) per pixel: mean |f[k+1] - 2 f[k] + f[k-1]| over a frame burst. Smooth
// movement scores ~0; flicker / shimmer scores high. Usage: node scripts/_jitter.mjs <dir> <prefix>
import sharp from "sharp";
import { readdirSync } from "node:fs";

const [dir, prefix] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.startsWith(prefix + "_") && f.endsWith(".png")).sort();
const frames = [];
let W = 0, H = 0;
for (const f of files) {
  const { data, info } = await sharp(`${dir}/${f}`).greyscale().raw().toBuffer({ resolveWithObject: true });
  W = info.width; H = info.height;
  frames.push(data);
}
const N = W * H;
const jit = new Float32Array(N);
for (let k = 1; k < frames.length - 1; k++) {
  const a = frames[k - 1], b = frames[k], c = frames[k + 1];
  for (let i = 0; i < N; i++) jit[i] += Math.abs(c[i] - 2 * b[i] + a[i]) / (frames.length - 2);
}
let sum = 0, hot = 0;
for (let i = 0; i < N; i++) { sum += jit[i]; if (jit[i] > 4) hot++; }
const heat = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) { const v = Math.min(255, jit[i] * 25); heat[i * 3] = v; heat[i * 3 + 1] = v * 0.45; }
await sharp(heat, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${dir}/jitter_${prefix}.png`);
console.log(JSON.stringify({ prefix, meanJitter: +(sum / N).toFixed(4), hotPixelsPct: +((hot / N) * 100).toFixed(3) }));
