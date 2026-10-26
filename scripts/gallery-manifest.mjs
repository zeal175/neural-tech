#!/usr/bin/env node
/**
 * Build-time photo index for gallery slugs.
 * Keeps serverless functions from bundling public/gallery (~1GB+ of JPGs)
 * while still letting pages know what exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const galleryRoot = path.join(root, "public", "gallery");
const outDir = path.join(root, "app", "gallery", "manifests");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const SKIP_FILES = new Set(["image.jpeg", "image.jpg", "image.png", "logo.png", "logo.jpg", "mark.png"]);
const HEADER_BYTES = 512 * 1024;

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
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
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
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= buffer.length) break;
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) break;
    offset += 2 + size;
  }
  return null;
}

function jpegOrientation(buffer) {
  // Match app/gallery/photos.js — swap w/h for 5–8.
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xe1) {
      const size = buffer.readUInt16BE(offset + 2);
      const start = offset + 4;
      if (buffer.toString("ascii", start, start + 4) !== "Exif") {
        offset += 2 + size;
        continue;
      }
      const tiff = start + 6;
      const little = buffer.toString("ascii", tiff, tiff + 2) === "II";
      const u16 = (o) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
      const u32 = (o) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));
      const ifd = tiff + u32(tiff + 4);
      const entries = u16(ifd);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (u16(entry) === 0x0112) return u16(entry + 8);
      }
      offset += 2 + size;
      continue;
    }
    if (marker === 0xda) break;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) break;
    offset += 2 + size;
  }
  return 1;
}

function readDimensions(filePath) {
  try {
    const buffer = readHead(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let size = null;
    if (ext === ".png") size = pngSize(buffer);
    else if (ext === ".gif") size = gifSize(buffer);
    else size = jpegSize(buffer);
    if (!size?.width || !size?.height) return { width: 1200, height: 900 };
    if (ext === ".jpg" || ext === ".jpeg") {
      const orientation = jpegOrientation(buffer);
      if (orientation >= 5 && orientation <= 8) {
        return { width: size.height, height: size.width };
      }
    }
    return size;
  } catch {
    return { width: 1200, height: 900 };
  }
}

function buildSlug(slug) {
  const dir = path.join(galleryRoot, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      if (SKIP_FILES.has(name.toLowerCase())) return false;
      if (name.startsWith(".")) return false;
      return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
    })
    .sort(naturalCompare)
    .map((file) => {
      const { width, height } = readDimensions(path.join(dir, file));
      return { file, width, height };
    });
}

fs.mkdirSync(outDir, { recursive: true });
const SKIP_SLUGS = new Set(["logos"]);
const slugs = fs
  .readdirSync(galleryRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => /^[a-z0-9][a-z0-9-]*$/i.test(name) && !SKIP_SLUGS.has(name));

for (const slug of slugs) {
  const photos = buildSlug(slug);
  const out = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(out, `${JSON.stringify(photos, null, 0)}\n`);
  console.log(`gallery manifest ${slug}: ${photos.length} photos → ${path.relative(root, out)}`);
}
