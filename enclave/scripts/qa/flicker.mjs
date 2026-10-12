// Temporal-stability report for a burst of frames: mean frame-to-frame change, and a heat map of
// per-pixel max change (bright = flickers). Usage: node scripts/_flicker.mjs <dir> <prefix>
import sharp from "sharp";
import { readdirSync } from "node:fs";

const [dir, prefix] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.startsWith(prefix + "_") && f.endsWith(".png")).sort();
const frames = [];
let W = 0, H = 0;
for (const f of files) {
  const { data, info } = await sharp(`${dir}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  W = info.width; H = info.height;
  frames.push(data);
}
const N = W * H;
const maxDiff = new Float32Array(N);
const perFrame = [];
for (let k = 1; k < frames.length; k++) {
  const a = frames[k - 1], b = frames[k];
  let sum = 0, changed = 0;
  for (let i = 0; i < N; i++) {
    const d = (Math.abs(a[i * 3] - b[i * 3]) + Math.abs(a[i * 3 + 1] - b[i * 3 + 1]) + Math.abs(a[i * 3 + 2] - b[i * 3 + 2])) / 3;
    sum += d;
    if (d > 3) changed++;
    if (d > maxDiff[i]) maxDiff[i] = d;
  }
  perFrame.push({ mean: +(sum / N).toFixed(3), changedPct: +((changed / N) * 100).toFixed(2) });
}
const heat = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  const v = Math.min(255, maxDiff[i] * 8);
  heat[i * 3] = v; heat[i * 3 + 1] = v * 0.4; heat[i * 3 + 2] = 0;
}
await sharp(heat, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${dir}/heat_${prefix}.png`);
const changedFrames = perFrame.filter((f) => f.changedPct > 0.05).length;
console.log(JSON.stringify({ prefix, frames: frames.length, changedFrames, worst: perFrame.reduce((m, f) => (f.changedPct > m.changedPct ? f : m), perFrame[0]), perFrame: perFrame.map((f) => f.changedPct) }));
