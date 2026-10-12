// Event-day check-in: the organizer scans a pass QR (app/checkin) and the person is recorded in
// the attendance sheet with the same details as their registration.
// Production: the Apps Script web app (scripts/google-sheet-webhook.gs) writes to a separate
// "ENCLAVE Attendance" Google Sheet. Local dev without REGISTRATIONS_WEBHOOK_URL:
// data/attendance.csv, looked up against data/registrations.csv. Both answer the same shapes.
import path from "path";
import { appendCsv, callSheet, DATA_DIR, HEADERS, readCsv, REGISTRATIONS_CSV } from "./save-registration";

// the registration's details (team columns included), with the check-in time first
export const ATT_HEADERS = ["checked_in_at", ...HEADERS.filter((h) => h !== "submitted_at")];
const ATTENDANCE_CSV = path.join(DATA_DIR, "attendance.csv");

/** "ENCLAVE:ENC-7Q4KD", "enc-7q4kd" -> "ENC-7Q4KD" ("" if it isn't a pass). */
export function passOf(raw) {
  return String(raw || "").toUpperCase().match(/ENC-[23456789A-HJ-NP-Z]{5}/)?.[0] || "";
}

const sheet = () => !!process.env.REGISTRATIONS_WEBHOOK_URL;
function local() {
  // serverless file systems are read-only: without a sheet there is nothing to check against
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
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

const full = (r) => ({ passId: r.pass_id, name: r.name, rrn: r.rrn, dept: r.dept, section: r.section, year: r.year, team: r.team_name || "" });

/** A team member's team: its name and the teammate, with when they checked in (null: not yet). */
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

export async function stats() {
  if (sheet()) return callSheet({ action: "stats" });
  local();
  return { ok: true, ...(await localStats()) };
}

/** status: checked_in | already (with the first check-in time) | unknown */
export async function checkIn(raw) {
  const passId = passOf(raw);
  if (sheet()) return callSheet({ action: "checkin", passId });
  local();
  const reg = passId && (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => r.pass_id === passId);
  if (!reg) return { ok: true, status: "unknown", passId, ...(await localStats()) };
  return localMark(reg);
}

/** A pass ID or an RRN -> the registrant, and when they checked in (null if not yet). */
export async function lookup(query) {
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
  if (sheet()) return callSheet({ action: "walkin", person });
  local();
  const rrn = person.rrn.toUpperCase();
  const reg = (await readCsv(REGISTRATIONS_CSV, HEADERS)).find((r) => r.rrn.toUpperCase() === rrn);
  if (reg) return localMark(reg); // they did register: check in their pass instead
  const seen = (await readCsv(ATTENDANCE_CSV, ATT_HEADERS)).find((r) => r.rrn.toUpperCase() === rrn);
  const who = { pass_id: "WALK-IN", ...person, rrn, entry: person.team_name ? "Team" : "Solo" };
  if (seen) return { ok: true, status: "already", at: seen.checked_in_at, person: full(seen), ...(await localStats()) };
  const at = stamp();
  await appendCsv(ATTENDANCE_CSV, ATT_HEADERS, { ...who, checked_in_at: at });
  return { ok: true, status: "checked_in", at, person: full(who), ...(await localStats()) };
}
