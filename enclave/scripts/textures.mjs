// Convert the 16-bit Blender bake masters into web textures. Usage: npm run textures
// Lossless WebP: these are data maps (normals, AO/roughness, curvature/thickness), so chroma
// subsampling or lossy colour transforms would corrupt the channels.
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";

const BAKES = "blender/bakes";
const OUT = "public/textures";
mkdirSync(OUT, { recursive: true });

// nearLossless: lossless coding after a tiny value pre-quantisation (no chroma subsampling).
const exact = { lossless: true, effort: 6 };
const near = { lossless: true, nearLossless: true, quality: 60, effort: 6 };
const jobs = [
  ["normal_4k.png", "bust_normal_4k.webp", 4096, exact],
  ["normal_4k.png", "bust_normal_2k.webp", 2048, exact],
  ["orm_4k.png", "bust_orm_2k.webp", 2048, near], // progressive upgrade (high tier)
  ["orm_4k.png", "bust_orm_1k.webp", 1024, near], // first load: AO + roughness are low-frequency
  ["data_4k.png", "bust_data_1k.webp", 1024, near],
  ["detail_1k.png", "detail_normal.webp", 512, near],
];

for (const [src, dst, size, webp] of jobs) {
  const out = `${OUT}/${dst}`;
  await sharp(`${BAKES}/${src}`)
    .resize(size, size, { kernel: "lanczos3" })
    .toColourspace("srgb")
    .webp(webp)
    .toFile(out);
  console.log(`${dst.padEnd(24)} ${String(Math.round(statSync(out).size / 1024)).padStart(6)} KB`);
}
