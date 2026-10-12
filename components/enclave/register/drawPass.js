import QRCode from "qrcode";
import { EVENT } from "@/lib/enclave/event";

export const PASS_W = 1080;
export const PASS_H = 1350;
const EMBER = "#fb7558";
const RIM = "#ff3b1f";
const CREAM = "#f5ebdd";

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** CSS font-family list behind a next/font variable (e.g. --font-screamer). */
function family(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function fitText(ctx, text, font, maxWidth, startSize) {
  let size = startSize;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/**
 * Draw one person's ENCLAVE pass (Instagram portrait 1080x1350) onto `canvas`.
 * pass: { passId, name, dept, section, year, teamName? }.
 * Layering follows the poster: giant title behind the bust, details below.
 * The QR encodes only the pass ID (look it up in the sheet at the door) - no personal data.
 */
export async function drawPass(canvas, pass) {
  canvas.width = PASS_W;
  canvas.height = PASS_H;
  const ctx = canvas.getContext("2d");
  const display = family("--font-screamer", "Impact, sans-serif");
  const title = family("--font-pillar", display);
  const sans = family("--font-poppins", "system-ui, sans-serif");
  const mono = family("--font-pixel", "ui-monospace, monospace");
  await Promise.all([
    document.fonts.load(`700 200px ${display}`),
    document.fonts.load(`400 200px ${title}`),
    document.fonts.load(`500 40px ${sans}`),
    document.fonts.load(`400 24px ${mono}`),
  ]).catch(() => {});

  // background: black, faint dot grid, red halo behind the head
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, PASS_W, PASS_H);
  ctx.fillStyle = "rgba(245,235,221,0.06)";
  for (let y = 10; y < PASS_H; y += 22) for (let x = 10; x < PASS_W; x += 22) ctx.fillRect(x, y, 2, 2);
  const halo = ctx.createRadialGradient(540, 520, 40, 540, 520, 560);
  halo.addColorStop(0, "rgba(255,59,31,0.22)");
  halo.addColorStop(1, "rgba(255,59,31,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, PASS_W, PASS_H);

  // giant ENCLAVE wordmark in Pillar, behind the bust like the poster (caps = 0.68 x size)
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleSize = fitText(ctx, EVENT.name, (s) => `400 ${s}px ${title}`, PASS_W - 96, 900);
  ctx.fillStyle = EMBER;
  ctx.fillText(EVENT.name, PASS_W / 2, 108 + titleSize * 0.68);
  ctx.restore();

  // the bust (transparent Cycles render, head bowed in three-quarter view; see 06_render.py).
  // ?v= changes whenever the art does, so no one gets an old cached figure.
  try {
    const art = await loadImage("/enclave/pass/bust.webp?v=2");
    ctx.drawImage(art, 0, 40, PASS_W, PASS_H);
  } catch {
    /* pass still works without the art */
  }

  // fade the bottom into black for the details
  const fade = ctx.createLinearGradient(0, 860, 0, PASS_H);
  fade.addColorStop(0, "rgba(5,5,5,0)");
  fade.addColorStop(0.45, "rgba(5,5,5,0.92)");
  fade.addColorStop(1, "rgba(5,5,5,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 860, PASS_W, PASS_H - 860);

  // header line
  ctx.fillStyle = "rgba(245,235,221,0.55)";
  ctx.font = `500 22px ${mono}`;
  ctx.textAlign = "left";
  ctx.fillText(`${EVENT.club} · ${EVENT.department}`.toUpperCase(), 56, 66);
  ctx.textAlign = "right";
  ctx.fillText("ACCESS PASS", PASS_W - 56, 66);

  // details
  const left = 56;
  ctx.textAlign = "left";
  // the entry this pass belongs to: solo, or the team (each teammate has their own pass)
  ctx.fillStyle = RIM;
  const entry = (pass.teamName ? `Team · ${pass.teamName}` : "Solo entry").toUpperCase();
  fitText(ctx, entry, (s) => `500 ${s}px ${mono}`, 640, 22);
  ctx.fillText(entry, left, 1052);
  ctx.fillStyle = CREAM;
  fitText(ctx, pass.name, (s) => `500 ${s}px ${sans}`, 640, 64);
  ctx.fillText(pass.name, left, 1118);
  ctx.fillStyle = "rgba(245,235,221,0.7)";
  ctx.font = `500 24px ${mono}`;
  ctx.fillText([pass.dept, pass.year, pass.section && `SEC ${pass.section}`].filter(Boolean).join(" · ").toUpperCase(), left, 1162);

  ctx.fillStyle = EMBER;
  ctx.font = `700 120px ${display}`;
  ctx.fillText(EVENT.date, left, 1290);
  const col = left + ctx.measureText(EVENT.date).width + 30;
  // venue once it is set (else the institution), kept clear of the QR tile
  const place = (EVENT.venueSet ? EVENT.venue : EVENT.institution).toUpperCase();
  ctx.fillStyle = "rgba(245,235,221,0.55)";
  fitText(ctx, place, (s) => `500 ${s}px ${mono}`, PASS_W - 56 - 212 - 8 - 24 - col, 22);
  ctx.fillText(place, col, 1250);
  ctx.fillStyle = CREAM;
  ctx.font = `500 34px ${mono}`;
  ctx.fillText(pass.passId, col, 1292);

  // QR on a light tile (dark-on-light scans reliably everywhere)
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, `ENCLAVE:${pass.passId}`, {
    width: 196,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0b0b0c", light: "#f5ebdd" },
  });
  const qx = PASS_W - 56 - 212;
  const qy = 1062;
  ctx.fillStyle = CREAM;
  roundRect(ctx, qx - 8, qy - 8, 228, 228, 18);
  ctx.fill();
  ctx.drawImage(qr, qx, qy, 212, 212);
  ctx.fillStyle = "rgba(245,235,221,0.55)";
  ctx.font = `500 18px ${mono}`;
  ctx.textAlign = "center";
  ctx.fillText("SCAN AT ENTRY", qx + 106, qy + 250);
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function passBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
