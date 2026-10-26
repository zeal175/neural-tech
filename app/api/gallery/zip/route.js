// Bundles the photos a visitor marked into one download. Store-only ZIP (photos are
// already compressed), streamed a file at a time, written by hand so the archive
// stays dependency-free.
//
// Photos are fetched over HTTP from the CDN (`/gallery/...`) so serverless
// functions do not have to ship the ~1GB public/gallery tree in their bundle.

import path from "node:path";
import { getEvent } from "@/app/gallery/events";
import { listPhotoFiles } from "@/app/gallery/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 100;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const EOCD = 22;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day =
    (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function localHeader({ name, crc, size, time, day, flags }) {
  const header = Buffer.alloc(LOCAL_HEADER);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name]);
}

function centralHeader({ name, crc, size, time, day, flags, offset }) {
  const header = Buffer.alloc(CENTRAL_HEADER);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(flags, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(day, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function endRecord({ count, size, offset }) {
  const record = Buffer.alloc(EOCD);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(count, 8);
  record.writeUInt16LE(count, 10);
  record.writeUInt32LE(size, 12);
  record.writeUInt32LE(offset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

function streamOf(generator) {
  const iterator = generator[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      iterator.return?.();
    },
  });
}

async function* zipEntries(entries) {
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const data = entry.data;
    const name = Buffer.from(entry.file, "utf8");
    const meta = {
      name,
      crc: crc32(data),
      size: data.length,
      flags: /^[\x20-\x7e]*$/.test(entry.file) ? 0 : 0x0800,
      ...dosStamp(entry.modified),
    };

    yield localHeader(meta);
    yield data;

    central.push(centralHeader({ ...meta, offset }));
    offset += LOCAL_HEADER + name.length + data.length;
  }

  const directory = Buffer.concat(central);
  yield directory;
  yield endRecord({ count: central.length, size: directory.length, offset });
}

export async function GET(request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const slug = params.get("event") || "";

  const event = getEvent(slug);
  if (!event || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return new Response("Unknown event.\n", { status: 404 });
  }

  const allowed = new Set(listPhotoFiles(slug));
  const requested = params
    .getAll("file")
    .map((value) => path.basename(value.trim()))
    .filter((file) => allowed.has(file));

  if (!requested.length) {
    return new Response("Nothing to download.\n", { status: 400 });
  }
  if (requested.length > MAX_FILES) {
    return new Response(`Too many files — ${MAX_FILES} max per zip.\n`, { status: 413 });
  }

  const origin = url.origin;
  let total = 0;
  const entries = [];

  for (const file of requested) {
    const response = await fetch(`${origin}/gallery/${slug}/${encodeURIComponent(file)}`, {
      cache: "force-cache",
    });
    if (!response.ok) {
      return new Response(`${file} could not be read.\n`, { status: 404 });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) {
      return new Response(`${file} is too large to bundle.\n`, { status: 413 });
    }
    total += buffer.length;
    if (total > MAX_TOTAL_BYTES) {
      return new Response("That selection is too large to bundle.\n", { status: 413 });
    }
    entries.push({
      file,
      data: buffer,
      modified: new Date(response.headers.get("last-modified") || Date.now()),
    });
  }

  const nameBytes = entries.reduce((sum, entry) => sum + Buffer.byteLength(entry.file, "utf8"), 0);
  const length =
    entries.length * (LOCAL_HEADER + CENTRAL_HEADER) + nameBytes * 2 + total + EOCD;

  return new Response(streamOf(zipEntries(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(length),
      "Content-Disposition": `attachment; filename="neural-tech-${slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
