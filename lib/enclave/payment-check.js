/**
 * Light payment-screenshot checks (not proof of payment).
 * Hard fail: blank / tiny / unreadable image.
 * Soft OCR: look for a recent date + fee amount; missing text does not block.
 */
import sharp from "sharp";

const MIN_EDGE = 240;
const MAX_AGE_DAYS = 14; // reject OCR dates clearly older than this

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLooseDate(text) {
  const t = text.replace(/\u00a0/g, " ");
  const found = [];

  // 12/10/2026, 12-10-26, 12.10.2026
  for (const m of t.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g)) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    // if first number > 12, it's D/M; if second > 12, it's M/D already wrong → swap
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2100) {
      found.push(new Date(year, month - 1, day));
    }
  }

  // 12 Oct 2026 / Oct 12, 2026
  for (const m of t.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{2,4})\b/g)) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon == null) continue;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    found.push(new Date(year, mon, Number(m[1])));
  }
  for (const m of t.matchAll(/\b([A-Za-z]{3,9})\s*(\d{1,2}),?\s*(\d{2,4})\b/g)) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon == null) continue;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    found.push(new Date(year, mon, Number(m[2])));
  }

  return found.filter((d) => !Number.isNaN(d.getTime()));
}

function hasFee(text, feeRupees) {
  const n = String(feeRupees || "50").replace(/[^\d]/g, "") || "50";
  const t = text.replace(/,/g, "");
  const patterns = [
    new RegExp(`₹\\s*${n}(?:\\.0+)?\\b`),
    new RegExp(`\\bRs\\.?\\s*${n}(?:\\.0+)?\\b`, "i"),
    new RegExp(`\\bINR\\s*${n}(?:\\.0+)?\\b`, "i"),
    new RegExp(`\\b${n}\\.00\\b`),
  ];
  return patterns.some((re) => re.test(t));
}

/**
 * @returns {{ ok: true, notes: string[] } | { ok: false, error: string }}
 */
export async function checkPaymentImage(bytes, { feeAmount = "50" } = {}) {
  const notes = [];
  let image;
  try {
    image = sharp(bytes, { failOn: "none" });
  } catch {
    return { ok: false, error: "That doesn’t look like a valid image. Try another screenshot." };
  }

  let meta;
  let stats;
  try {
    meta = await image.metadata();
    stats = await image.stats();
  } catch {
    return { ok: false, error: "Couldn’t read that image. Try a JPG or PNG screenshot." };
  }

  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < MIN_EDGE || h < MIN_EDGE) {
    return { ok: false, error: "That screenshot is too small. Upload the full payment screen." };
  }

  // nearly flat image (solid colour / blank)
  const channels = stats.channels || [];
  const avgStd = channels.reduce((s, c) => s + (c.stdev || 0), 0) / Math.max(1, channels.length);
  if (avgStd < 4) {
    return { ok: false, error: "That image looks blank. Upload a clear payment screenshot." };
  }

  // Soft OCR (timeout): date + amount. Missing text = warning, not a hard fail.
  let ocrText = "";
  try {
    const { createWorker } = await import("tesseract.js");
    const resized = await sharp(bytes)
      .rotate()
      .resize({ width: 1000, withoutEnlargement: true })
      .greyscale()
      .normalize()
      .png()
      .toBuffer();

    const worker = await createWorker("eng", 1, { logger: () => {} });
    const raced = Promise.race([
      worker.recognize(resized).then((r) => r.data.text || ""),
      new Promise((_, rej) => setTimeout(() => rej(new Error("ocr-timeout")), 12000)),
    ]);
    try {
      ocrText = await raced;
    } finally {
      await worker.terminate().catch(() => {});
    }
  } catch {
    notes.push("ocr-skipped");
  }

  if (ocrText) {
    const dates = parseLooseDate(ocrText);
    const today = startOfDay(new Date());
    const oldestOk = new Date(today);
    oldestOk.setDate(oldestOk.getDate() - MAX_AGE_DAYS);

    if (dates.length) {
      const newest = dates.reduce((a, b) => (a > b ? a : b));
      const day = startOfDay(newest);
      if (day > today) {
        // OCR misread as future — don't block
        notes.push("date-future-ignored");
      } else if (day < oldestOk) {
        return {
          ok: false,
          error: `That payment looks too old (around ${day.toLocaleDateString("en-IN")}). Pay ${feeAmount ? `₹${feeAmount}` : "the fee"} now and upload a fresh screenshot.`,
        };
      } else {
        notes.push(`date-ok:${day.toISOString().slice(0, 10)}`);
      }
    } else {
      notes.push("date-not-found");
    }

    if (hasFee(ocrText, feeAmount)) notes.push("amount-ok");
    else notes.push("amount-not-found");
  }

  return { ok: true, notes };
}
