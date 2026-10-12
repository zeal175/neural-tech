import QRCode from "qrcode";
import { EVENT } from "@/lib/enclave/event";

export const PASS_W = 1080;
export const PASS_H = 1350;

const INK = "#070605";
const EMBER = "#fb7558";
const CORE = "#ffc59a";
const CREAM = "#f5ebdd";
const MUTED = "rgba(245,235,221,0.55)";
const FAINT = "rgba(245,235,221,0.16)";

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function family(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function fitText(ctx, text, font, maxWidth, startSize) {
  let size = startSize;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function corner(ctx, x, y, len, dirX, dirY) {
  ctx.beginPath();
  ctx.moveTo(x, y + dirY * len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dirX * len, y);
  ctx.stroke();
}

/**
 * ENCLAVE access pass (1080×1350) on Pass.png art.
 * QR encodes only `ENCLAVE:<passId>` — no personal data.
 */
export async function drawPass(canvas, pass) {
  canvas.width = PASS_W;
  canvas.height = PASS_H;
  const ctx = canvas.getContext("2d");
  const title = family("--font-pillar", "Impact, sans-serif");
  const sans = family("--font-montserrat", family("--font-poppins", "system-ui, sans-serif"));

  await Promise.all([
    document.fonts.load(`400 200px ${title}`),
    document.fonts.load(`500 48px ${sans}`),
    document.fonts.load(`600 56px ${sans}`),
  ]).catch(() => {});

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, PASS_W, PASS_H);

  // Pass.png (1080×1920) → framed crop
  try {
    const art = await loadImage("/enclave/pass/Pass.png?v=2");
    const srcH = Math.round(art.width * (PASS_H / PASS_W));
    const sy = Math.max(0, Math.round((art.height - srcH) * 0.06));
    ctx.drawImage(art, 0, sy, art.width, Math.min(srcH, art.height - sy), 0, 0, PASS_W, PASS_H);
  } catch {
    /* art optional */
  }

  // top vignette so meta stays readable over the poster
  const topFog = ctx.createLinearGradient(0, 0, 0, 160);
  topFog.addColorStop(0, "rgba(7,6,5,0.72)");
  topFog.addColorStop(1, "rgba(7,6,5,0)");
  ctx.fillStyle = topFog;
  ctx.fillRect(0, 0, PASS_W, 160);

  // frame corners
  ctx.strokeStyle = "rgba(251,117,88,0.55)";
  ctx.lineWidth = 2;
  const inset = 36;
  const arm = 28;
  corner(ctx, inset, inset, arm, 1, 1);
  corner(ctx, PASS_W - inset, inset, arm, -1, 1);
  corner(ctx, inset, PASS_H - inset, arm, 1, -1);
  corner(ctx, PASS_W - inset, PASS_H - inset, arm, -1, -1);

  // top meta
  ctx.fillStyle = EMBER;
  ctx.font = `500 18px ${sans}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ACCESS PASS", 64, 70);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText(pass.passId, PASS_W - 64, 70);

  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 90);
  ctx.lineTo(PASS_W - 64, 90);
  ctx.stroke();
  // ember tick on the rule
  ctx.strokeStyle = EMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 90);
  ctx.lineTo(140, 90);
  ctx.stroke();

  // bottom plate
  const plateY = 820;
  const plate = ctx.createLinearGradient(0, plateY, 0, PASS_H);
  plate.addColorStop(0, "rgba(7,6,5,0)");
  plate.addColorStop(0.22, "rgba(7,6,5,0.75)");
  plate.addColorStop(0.45, "rgba(7,6,5,0.96)");
  plate.addColorStop(1, INK);
  ctx.fillStyle = plate;
  ctx.fillRect(0, plateY, PASS_W, PASS_H - plateY);

  // glass card for details
  const cardX = 48;
  const cardY = 940;
  const cardW = PASS_W - 96;
  const cardH = 360;
  ctx.fillStyle = "rgba(7,6,5,0.55)";
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = "rgba(251,117,88,0.28)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cardX + 0.75, cardY + 0.75, cardW - 1.5, cardH - 1.5);

  // thin inner ember line under card top
  ctx.strokeStyle = "rgba(251,117,88,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 28, cardY);
  ctx.lineTo(cardX + 120, cardY);
  ctx.stroke();

  const left = cardX + 36;
  const qrSize = 176;
  const qrPad = 12;
  const qrBox = qrSize + qrPad * 2;
  const qx = PASS_W - 64 - qrBox;
  const qy = cardY + 40;
  const textMax = qx - left - 28;

  ctx.textAlign = "left";
  ctx.fillStyle = EMBER;
  ctx.font = `500 16px ${sans}`;
  const entry = (pass.teamName ? `Team · ${pass.teamName}` : "Solo entry").toUpperCase();
  ctx.fillText(entry, left, cardY + 48);

  ctx.fillStyle = CREAM;
  fitText(ctx, pass.name, (s) => `600 ${s}px ${sans}`, textMax, 52);
  ctx.fillText(pass.name, left, cardY + 112);

  ctx.fillStyle = MUTED;
  const meta = [pass.dept, pass.year, pass.section && `Sec ${pass.section}`].filter(Boolean).join(" · ").toUpperCase();
  fitText(ctx, meta, (s) => `500 ${s}px ${sans}`, textMax, 18);
  ctx.fillText(meta, left, cardY + 152);

  // divider
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, cardY + 190);
  ctx.lineTo(left + textMax, cardY + 190);
  ctx.stroke();

  const place = (EVENT.venueSet ? EVENT.venue : EVENT.institution).toUpperCase();
  ctx.fillStyle = MUTED;
  fitText(ctx, place, (s) => `500 ${s}px ${sans}`, textMax, 17);
  ctx.fillText(place, left, cardY + 240);

  ctx.fillStyle = EMBER;
  ctx.font = `400 56px ${title}`;
  ctx.fillText(EVENT.date, left, cardY + 310);
  const dateAdvance = ctx.measureText(EVENT.date).width;
  ctx.fillStyle = CORE;
  ctx.font = `500 16px ${sans}`;
  ctx.fillText(EVENT.timeLabel, left + dateAdvance + 20, cardY + 300);

  // QR tile with ember rim
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, `ENCLAVE:${pass.passId}`, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: INK, light: CREAM },
  });
  ctx.fillStyle = "rgba(251,117,88,0.85)";
  ctx.fillRect(qx - 3, qy - 3, qrBox + 6, qrBox + 6);
  ctx.fillStyle = CREAM;
  ctx.fillRect(qx, qy, qrBox, qrBox);
  ctx.drawImage(qr, qx + qrPad, qy + qrPad, qrSize, qrSize);

  ctx.fillStyle = MUTED;
  ctx.font = `500 14px ${sans}`;
  ctx.textAlign = "center";
  ctx.fillText("SCAN AT ENTRY", qx + qrBox / 2, qy + qrBox + 32);

  return canvas;
}

export function passBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
