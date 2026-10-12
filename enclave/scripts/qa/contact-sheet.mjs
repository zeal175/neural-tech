// Labelled contact sheet of colourway previews (hero crop + face close-up per option).
// Usage: node scripts/qa/contact-sheet.mjs <dir> <out.png> name:Label ...
import sharp from "sharp";

const [dir, out, ...items] = process.argv.slice(2);
const entries = items.map((s) => { const i = s.indexOf(":"); return { name: s.slice(0, i), label: s.slice(i + 1) }; });
const TW = 560, TH = 420, FW = 236, LABEL = 46, GAP = 14;
const cellW = TW + FW + GAP, cellH = TH + LABEL;
const cols = 2, rows = Math.ceil(entries.length / cols);
const W = cols * cellW + (cols + 1) * GAP, H = rows * cellH + (rows + 1) * GAP;
const comps = [];
for (const [k, e] of entries.entries()) {
  const x = GAP + (k % cols) * (cellW + GAP), y = GAP + Math.floor(k / cols) * (cellH + GAP);
  // hero: centre of the 1440x900 viewport (title + figure)
  const hero = await sharp(`${dir}/${e.name}_hero.png`).extract({ left: 170, top: 40, width: 1100, height: 825 }).resize(TW, TH).toBuffer();
  const face = await sharp(`${dir}/${e.name}_face.png`).resize(FW, TH, { fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${LABEL}"><text x="4" y="31" font-family="Segoe UI, Arial" font-size="24" font-weight="600" fill="#f5ebdd">${e.label}</text></svg>`);
  comps.push({ input: label, left: x, top: y }, { input: hero, left: x, top: y + LABEL }, { input: face, left: x + TW + GAP, top: y + LABEL });
}
await sharp({ create: { width: W, height: H, channels: 3, background: "#151515" } }).composite(comps).png().toFile(out);
console.log(out, W, "x", H);
