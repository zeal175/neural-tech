// Event-day check-in: organizer scans a pass QR at /enclave/checkin.
// Priority: Supabase `enclave_attendance` → Google Sheet webhook → local CSV (dev).
import path from "path";
import { appendCsv, callSheet, DATA_DIR, HEADERS, readCsv, REGISTRATIONS_CSV, TABLE as REG_TABLE } from "./save-registration";
import { sbInsert, sbSelect, supabaseConfigured } from "./supabase";

export const ATT_HEADERS = ["checked_in_at", ...HEADERS.filter((h) => h !== "submitted_at")];
export const ATT_TABLE = "enclave_attendance";
const ATTENDANCE_CSV = path.join(DATA_DIR, "attendance.csv");

/** "ENCLAVE:ENC-7Q4KD", "enc-7q4kd" -> "ENC-7Q4KD" ("" if it isn't a pass). */
export function passOf(raw) {
  return String(raw || "").toUpperCase().match(/ENC-[23456789A-HJ-NP-Z]{5}/)?.[0] || "";
}

const sheet = () => !!process.env.REGISTRATIONS_WEBHOOK_URL;
const cloud = () => supabaseConfigured();

function local() {
  if (process.env.VERCEL === "1") throw new Error("unconfigured");
}

/** India time, as the sheet shows it: "2026-10-16 09:42:13". */
function stamp() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Format a timestamptz / sheet stamp for the door UI. */
function atLabel(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value)) return value;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    return String(value);
  }
}

const full = (r) => ({
  passId: r.pass_id,
  name: r.name,
  rrn: r.rrn,
  dept: r.dept,
  section: r.section,
  year: r.year,
  team: r.team_name || "",
});

function attRowFromReg(reg, atIso) {
  return {
    checked_in_at: atIso || new Date().toISOString(),
    pass_id: reg.pass_id,
    name: reg.name,
    rrn: reg.rrn,
    dept: reg.dept || "",
    section: reg.section || "",
    year: reg.year || "",
    phone: reg.phone || "",
    entry: reg.entry || "Solo",
    team_name: reg.team_name || "",
    teammate: reg.teammate || "",
    team_id: reg.team_id || "",
  };
}

// ─── Supabase ────────────────────────────────────────────────────────────────

async function sbStats() {
  const [regs, att] = await Promise.all([
    sbSelect(REG_TABLE, "select=pass_id"),
    sbSelect(ATT_TABLE, "select=pass_id"),
  ]);
  return { registered: regs.length, checkedIn: att.length };
}

async function sbFindRegByPass(passId) {
  if (!passId) return null;
  const rows = await sbSelect(REG_TABLE, `pass_id=eq.${encodeURIComponent(passId)}&select=*&limit=1`);
  return rows[0] || null;
}

async function sbFindRegByRrn(rrn) {
  if (!rrn) return null;
  const rows = await sbSelect(REG_TABLE, `rrn=ilike.${encodeURIComponent(rrn)}&select=*&limit=1`);
  return rows[0] || null;
}

async function sbFindAttByPass(passId) {
  if (!passId || passId === "WALK-IN") return null;
  const rows = await sbSelect(ATT_TABLE, `pass_id=eq.${encodeURIComponent(passId)}&select=*&limit=1`);
  return rows[0] || null;
}

async function sbFindAttByRrn(rrn) {
  if (!rrn) return null;
  const rows = await sbSelect(ATT_TABLE, `rrn=ilike.${encodeURIComponent(rrn)}&select=*&limit=1`);
  return rows[0] || null;
}

async function sbTeam(reg) {
  if (!reg.team_id) return null;
  const mates = await sbSelect(
    REG_TABLE,
    `team_id=eq.${encodeURIComponent(reg.team_id)}&pass_id=neq.${encodeURIComponent(reg.pass_id)}&select=*&limit=1`,
  );
  const mate = mates[0];
  if (!mate) return { name: reg.team_name || "", mate: null };
  const seen = await sbFindAttByPass(mate.pass_id);
  return {
    name: reg.team_name || "",
    mate: { name: mate.name, passId: mate.pass_id, at: seen ? atLabel(seen.checked_in_at) : null },
  };
}

async function sbMark(reg) {
  const seen = (await sbFindAttByPass(reg.pass_id)) || (await sbFindAttByRrn(reg.rrn));
  if (seen) {
    return {
      ok: true,
      status: "already",
      at: atLabel(seen.checked_in_at),
      person: full(reg),
      team: await sbTeam(reg),
      ...(await sbStats()),
    };
  }

  const atIso = new Date().toISOString();
  try {
    await sbInsert(ATT_TABLE, [attRowFromReg(reg, atIso)]);
  } catch (error) {
    if (error.message === "duplicate") {
      const again = (await sbFindAttByPass(reg.pass_id)) || (await sbFindAttByRrn(reg.rrn));
      return {
        ok: true,
        status: "already",
        at: atLabel(again?.checked_in_at || atIso),
        person: full(reg),
        team: await sbTeam(reg),
        ...(await sbStats()),
      };
    }
    throw error;
  }

  return {
    ok: true,
    status: "checked_in",
    at: atLabel(atIso),
    person: full(reg),
    team: await sbTeam(reg),
    ...(await sbStats()),
  };
}

async function sbCheckIn(raw) {
  const passId = passOf(raw);
  const reg = await sbFindRegByPass(passId);
  if (!reg) return { ok: true, status: "unknown", passId, ...(await sbStats()) };
  return sbMark(reg);
}

async function sbLookup(query) {
  const q = String(query || "").trim().toUpperCase();
  if (!q) return { ok: true, found: false };
  const passId = passOf(q);
  const reg = passId ? await sbFindRegByPass(passId) : await sbFindRegByRrn(q);
  if (!reg) return { ok: true, found: false };
  const seen = (await sbFindAttByPass(reg.pass_id)) || (await sbFindAttByRrn(reg.rrn));
  return {
    ok: true,
    found: true,
    person: full(reg),
    at: seen ? atLabel(seen.checked_in_at) : null,
    team: await sbTeam(reg),
  };
}

async function sbWalkIn(person) {
  const rrn = person.rrn.toUpperCase();
  const reg = await sbFindRegByRrn(rrn);
  if (reg) return sbMark(reg);

  const seen = await sbFindAttByRrn(rrn);
  const who = {
    pass_id: "WALK-IN",
    name: person.name,
    rrn,
    dept: person.dept || "",
    section: person.section || "",
    year: person.year || "",
    phone: person.phone || "",
    entry: person.team_name ? "Team" : "Solo",
    team_name: person.team_name || "",
    teammate: "",
    team_id: "",
  };
  if (seen) {
    return { ok: true, status: "already", at: atLabel(seen.checked_in_at), person: full(seen), ...(await sbStats()) };
  }

  const atIso = new Date().toISOString();
  try {
    await sbInsert(ATT_TABLE, [attRowFromReg(who, atIso)]);
  } catch (error) {
    if (error.message === "duplicate") {
      const again = await sbFindAttByRrn(rrn);
      return {
        ok: true,
        status: "already",
        at: atLabel(again?.checked_in_at || atIso),
        person: full(again || who),
        ...(await sbStats()),
      };
    }
    throw error;
  }
  return { ok: true, status: "checked_in", at: atLabel(atIso), person: full(who), ...(await sbStats()) };
}

// ─── Local CSV (dev) ─────────────────────────────────────────────────────────

async function localTeam(reg) {
  if (!reg.team_id) return null;
  const mate = (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => r.team_id === reg.team_id && r.pass_id !== reg.pass_id);
  const seen = mate && (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).find((r) => r.pass_id === mate.pass_id);
  return { name: reg.team_name, mate: mate ? { name: mate.name, passId: mate.pass_id, at: seen ? seen.checked_in_at : null } : null };
}

async function localStats() {
  return {
    registered: (await readCsv(REGISTRATIONS_CSV, HEADERS)).length,
    checkedIn: (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).length,
  };
}

async function localMark(reg) {
  const seen = (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).find((r) => r.pass_id === reg.pass_id);
  let status = "already";
  let at = seen?.checked_in_at;
  if (!seen) {
    status = "checked_in";
    at = stamp();
    await appendCsv(ATTENDANCE_CSV, ATT_HEADERS, { ...reg, checked_in_at: at });
  }
  return { ok: true, status, at, person: full(reg), team: await localTeam(reg), ...(await localStats()) };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function stats() {
  if (cloud()) return { ok: true, ...(await sbStats()) };
  if (sheet()) return callSheet({ action: "stats" });
  local();
  return { ok: true, ...(await localStats()) };
}

/** status: checked_in | already (with the first check-in time) | unknown */
export async function checkIn(raw) {
  if (cloud()) return sbCheckIn(raw);
  const passId = passOf(raw);
  if (sheet()) return callSheet({ action: "checkin", passId });
  local();
  const reg = passId && (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => r.pass_id === passId);
  if (!reg) return { ok: true, status: "unknown", passId, ...(await localStats()) };
  return localMark(reg);
}

/** A pass ID or an RRN -> the registrant, and when they checked in (null if not yet). */
export async function lookup(query) {
  if (cloud()) return sbLookup(query);
  const q = String(query || "").trim().toUpperCase();
  if (!q) return { ok: true, found: false };
  if (sheet()) return callSheet({ action: "lookup", query: q });
  local();
  const passId = passOf(q);
  const reg = (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => (passId ? r.pass_id === passId : r.rrn.toUpperCase() === q));
  if (!reg) return { ok: true, found: false };
  const seen = (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).find((r) => r.pass_id === reg.pass_id);
  return { ok: true, found: true, person: full(reg), at: seen ? seen.checked_in_at : null, team: await localTeam(reg) };
}

/**
 * Someone without a pass (Google Form registrants, walk-ins), recorded by their RRN with
 * pass ID WALK-IN. `team_name` is optional (a team member at the desk).
 */
export async function walkIn(person) {
  if (cloud()) return sbWalkIn(person);
  if (sheet()) return callSheet({ action: "walkin", person });
  local();
  const rrn = person.rrn.toUpperCase();
  const reg = (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => r.rrn.toUpperCase() === rrn);
  if (reg) return localMark(reg);
  const seen = (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).find((r) => r.rrn.toUpperCase() === rrn);
  const who = { pass_id: "WALK-IN", ...person, rrn, entry: person.team_name ? "Team" : "Solo" };
  if (seen) return { ok: true, status: "already", at: seen.checked_in_at, person: full(seen), ...(await localStats()) };
  const at = stamp();
  await appendCsv(ATTENDANCE_CSV, ATT_HEADERS, { ...who, checked_in_at: at });
  return { ok: true, status: "checked_in", at, person: full(who), ...(await localStats()) };
}
