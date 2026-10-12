// Registration storage: Supabase (preferred) → Google Sheet webhook → local CSV (dev only).
// An entry is one person (solo) or a team of two: one row per person, teammates linked by team_id.
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { sbInsert, sbSelect, sbUpload, supabaseConfigured } from "./supabase";

export const HEADERS = [
  "submitted_at",
  "pass_id",
  "name",
  "rrn",
  "dept",
  "section",
  "year",
  "phone",
  "entry",
  "team_name",
  "teammate",
  "team_id",
  "payment_path",
];
export const DATA_DIR = path.join(process.cwd(), "data");
export const PAYMENTS_DIR = path.join(DATA_DIR, "payments");
export const TABLE = "enclave_registrations";
export const PAYMENT_BUCKET = "enclave-payments";

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvLine(headers, row) {
  return headers.map((key) => csvCell(row[key])).join(",") + "\n";
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export async function readCsv(file, headers) {
  let text = "";
  try {
    text = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n").filter(Boolean);
  const head = lines.length ? parseCsvLine(lines[0]).map((h) => h.trim()) : [];
  if (!head.length || !head.every((h) => headers.includes(h))) return [];
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((key) => [key, ""]));
    head.forEach((key, i) => (row[key] = cells[i] ?? ""));
    return row;
  });
}

export async function appendCsv(file, headers, rows) {
  const add = [].concat(rows);
  await mkdir(path.dirname(file), { recursive: true });
  const text = await readFile(file, "utf8").catch(() => "");
  if (text.split("\n")[0].trim() === headers.join(",")) {
    await appendFile(file, add.map((r) => csvLine(headers, r)).join(""), "utf8");
    return;
  }
  const kept = await readCsv(file, headers);
  await writeFile(file, headers.join(",") + "\n" + [...kept, ...add].map((r) => csvLine(headers, r)).join(""), "utf8");
}

export const passOfRow = (row) => ({
  passId: row.pass_id,
  name: row.name,
  dept: row.dept,
  section: row.section,
  year: row.year,
});

export function entryOf(rows, row) {
  const mate = row.team_id ? rows.find((r) => r.team_id === row.team_id && r.pass_id !== row.pass_id) : null;
  return {
    entry: row.team_id ? "team" : "solo",
    teamName: row.team_name || "",
    passes: [passOfRow(row), ...(mate ? [passOfRow(mate)] : [])],
  };
}

export const REGISTRATIONS_CSV = path.join(DATA_DIR, "registrations.csv");

async function saveCsv(rows) {
  const all = await readCsv(REGISTRATIONS_CSV, HEADERS);
  const byRrn = (rrn) => all.find((r) => r.rrn.toUpperCase() === rrn);
  const mine = byRrn(rows[0].rrn);
  if (mine) return { duplicate: true, ...entryOf(all, mine) };
  if (rows[1] && byRrn(rows[1].rrn)) return { taken: "1.rrn" };
  await appendCsv(REGISTRATIONS_CSV, HEADERS, rows);
  return { duplicate: false, ...entryOf(rows, rows[0]) };
}

export async function callSheet(payload, ms = 20000) {
  let response;
  try {
    response = await fetch(process.env.REGISTRATIONS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
      cache: "no-store",
    });
  } catch (error) {
    const slow = error?.name === "TimeoutError" || /TIMEOUT/i.test(error?.cause?.code || "");
    throw new Error(slow ? "timeout" : "webhook");
  }
  if (!response.ok) throw new Error("webhook");
  const data = await response.json().catch(() => ({}));
  if (data.ok) return data;
  if (data.busy) throw new Error("timeout");
  if (data.error === "unknown action") {
    console.error("The Google Sheet's Apps Script is out of date: paste scripts/google-sheet-webhook.gs again and deploy a New version.");
    throw new Error("outdated");
  }
  throw new Error("webhook");
}

/**
 * Store a payment screenshot. Returns the storage path (or local relative path).
 * file: { bytes: Buffer|Uint8Array, contentType: string, ext: string }
 */
export async function savePaymentProof(passId, file) {
  const safeExt = (file.ext || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${passId}.${safeExt}`;

  if (supabaseConfigured()) {
    await sbUpload(PAYMENT_BUCKET, objectPath, file.bytes, file.contentType);
    return objectPath;
  }

  if (process.env.VERCEL === "1") throw new Error("unconfigured");
  await mkdir(PAYMENTS_DIR, { recursive: true });
  const localName = `${passId}.${safeExt}`;
  await writeFile(path.join(PAYMENTS_DIR, localName), file.bytes);
  return `local:${localName}`;
}

async function findByRrns(rrns) {
  const list = rrns.map((r) => r.toUpperCase()).filter(Boolean);
  if (!list.length) return [];
  const inList = list.map((r) => `"${r.replace(/"/g, "")}"`).join(",");
  return sbSelect(TABLE, `rrn=in.(${inList})&select=*`);
}

/** Look up an existing entry by the registering person's RRN (for “get my pass back”). */
export async function findEntryByRrn(rrn) {
  const clean = String(rrn || "").toUpperCase();
  if (!clean) return null;

  if (supabaseConfigured()) {
    const existing = await findByRrns([clean]);
    const mine = existing[0];
    if (!mine) return null;
    const teamRows = mine.team_id
      ? await sbSelect(TABLE, `team_id=eq.${encodeURIComponent(mine.team_id)}&select=*`)
      : [mine];
    return { duplicate: true, ...entryOf(teamRows, mine) };
  }

  if (process.env.VERCEL === "1") return null;
  const all = await readCsv(REGISTRATIONS_CSV, HEADERS);
  const mine = all.find((r) => r.rrn.toUpperCase() === clean);
  return mine ? { duplicate: true, ...entryOf(all, mine) } : null;
}

async function saveSupabase(rows) {
  const rrns = rows.map((r) => r.rrn.toUpperCase());
  const existing = await findByRrns(rrns);
  const byRrn = (rrn) => existing.find((r) => String(r.rrn).toUpperCase() === rrn);
  const mine = byRrn(rows[0].rrn);
  if (mine) {
    const teamRows = mine.team_id
      ? await sbSelect(TABLE, `team_id=eq.${encodeURIComponent(mine.team_id)}&select=*`)
      : [mine];
    return { duplicate: true, ...entryOf(teamRows, mine) };
  }
  if (rows[1] && byRrn(rows[1].rrn)) return { taken: "1.rrn" };

  const payload = rows.map((r) => ({
    submitted_at: r.submitted_at,
    pass_id: r.pass_id,
    name: r.name,
    rrn: r.rrn,
    dept: r.dept,
    section: r.section,
    year: r.year,
    phone: r.phone,
    entry: r.entry,
    team_name: r.team_name || "",
    teammate: r.teammate || "",
    team_id: r.team_id || "",
    payment_path: r.payment_path || null,
    payment_verified: false,
  }));

  try {
    await sbInsert(TABLE, payload);
  } catch (error) {
    if (error.message === "duplicate") {
      // race: someone else registered the same RRN between select and insert
      const again = await sbSelect(TABLE, `rrn=ilike.${encodeURIComponent(rows[0].rrn)}&select=*`);
      if (again[0]) {
        const teamRows = again[0].team_id
          ? await sbSelect(TABLE, `team_id=eq.${encodeURIComponent(again[0].team_id)}&select=*`)
          : again;
        return { duplicate: true, ...entryOf(teamRows, again[0]) };
      }
    }
    throw error;
  }
  return { duplicate: false, ...entryOf(rows, rows[0]) };
}

/**
 * Save an entry: one row (solo) or two (team).
 * -> { duplicate, entry, teamName, passes } or { taken: "1.rrn" }
 */
export async function saveRegistration(rows) {
  if (supabaseConfigured()) return saveSupabase(rows);

  if (process.env.REGISTRATIONS_WEBHOOK_URL) {
    const data = await callSheet({ action: "entry", rows });
    if (data.taken) return { taken: data.taken };
    if (!Array.isArray(data.passes) || !data.passes.length) throw new Error("outdated");
    return { duplicate: !!data.duplicate, entry: data.entry, teamName: data.teamName || "", passes: data.passes };
  }

  if (process.env.VERCEL === "1") throw new Error("unconfigured");
  return saveCsv(rows);
}

/** List recent registrations (admin). */
export async function listRegistrations(limit = 200) {
  if (supabaseConfigured()) {
    return sbSelect(TABLE, `select=*&order=submitted_at.desc&limit=${limit}`);
  }
  if (process.env.VERCEL === "1") throw new Error("unconfigured");
  const rows = await readCsv(REGISTRATIONS_CSV, HEADERS);
  return rows.reverse().slice(0, limit);
}
