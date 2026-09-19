// Server-only. Reads public/gallery/<slug>/ at build time so photos can be added
// by dropping files into the folder — no code edit, no image-size dependency.
// Intrinsic dimensions are parsed straight out of each file's header, which keeps
// next/image happy and the masonry free of layout shift.

import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/i;
const HEADER_BYTES = 512 * 1024;

export function eventDir(slug) {
  if (!SAFE_SLUG.test(slug)) return null;
  return path.join(process.cwd(), "public", "gallery", slug);
}

function naturalCompare(a, b) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function readHead(file) {
  const handle = fs.openSync(file, "r");
  try {
    const { size } = fs.fstatSync(handle);
    const length = Math.min(size, HEADER_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(handle, buffer, 0, length, 0);
    return buffer;
  } finally {
    fs.closeSync(handle);
  }
}

function pngSize(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function gifSize(buffer) {
  if (buffer.length < 10 || buffer.toString("latin1", 0, 3) !== "GIF") return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1; // resync past padding
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Start-of-frame markers carry the dimensions; C4/C8/CC are other tables.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(buffer) {
  if (buffer.length < 30) return null;
  if (buffer.toString("latin1", 0, 4) !== "RIFF" || buffer.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunk = buffer.toString("latin1", 12, 16);

  if (chunk === "VP8X") {
    return {
      width: (buffer.readUIntLE(24, 3) & 0xffffff) + 1,
      height: (buffer.readUIntLE(27, 3) & 0xffffff) + 1,
    };
  }

  if (chunk === "VP8 ") {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

function jpegOrientation(buffer) {
  if (buffer.length < 12 || buffer.readUInt16BE(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker === 0xe1) {
      const start = offset + 4;
      if (buffer.toString("ascii", start, start + 4) !== "Exif") return 1;
      const tiff = start + 6;
      const little = buffer.toString("ascii", tiff, tiff + 2) === "II";
      const u16 = (at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
      const u32 = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
      const ifd0 = tiff + u32(tiff + 4);
      if (ifd0 + 2 > buffer.length) return 1;
      const count = u16(ifd0);
      for (let i = 0; i < count; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > buffer.length) break;
        if (u16(entry) === 0x0112) return u16(entry + 8) || 1;
      }
      return 1;
    }
    if (marker === 0xda) break;
    if (length < 2) break;
    offset += 2 + length;
  }
  return 1;
}

function readDimensions(file) {
  try {
    const buffer = readHead(file);
    const size = pngSize(buffer) || jpegSize(buffer) || webpSize(buffer) || gifSize(buffer);
    if (!size || !size.width || !size.height) return { width: null, height: null };
    const orientation = jpegOrientation(buffer);
    if (orientation >= 5 && orientation <= 8) {
      return { width: size.height, height: size.width };
    }
    return size;
  } catch {
    return { width: null, height: null };
  }
}

function readCaptions(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, "captions.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Filenames only, sorted the way the wall shows them. Also the zip route's allow-list. */
export function listPhotoFiles(slug) {
  const dir = eventDir(slug);
  if (!dir) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort(naturalCompare);
  } catch {
    // Folder not created yet — the page renders its empty state instead.
    return [];
  }
}

export function readPhotos(slug, label = "") {
  const dir = eventDir(slug);
  if (!dir) return [];
  const captions = readCaptions(dir);

  return listPhotoFiles(slug).map((file, index) => {
    const entry = captions[file];
    const caption = typeof entry === "string" ? entry : entry?.caption || "";
    const alt =
      (typeof entry === "object" && entry?.alt) ||
      caption ||
      `${label ? `${label} — ` : ""}photo ${index + 1}`;
    const { width, height } = readDimensions(path.join(dir, file));

    return {
      file,
      src: `/gallery/${slug}/${file}`,
      caption,
      alt,
      width,
      height,
    };
  });
}
