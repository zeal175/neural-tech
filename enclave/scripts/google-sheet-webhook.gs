// Google Apps Script web app behind the ENCLAVE site (free). It stores registrations in this
// Google Sheet ("Registrations" tab) and event-day check-ins in a separate Google Sheet file
// ("ENCLAVE Attendance").
//
// Setup (README.md -> "Registrations & check-in"):
//   1. Paste this whole file into Extensions -> Apps Script of the registrations Sheet, save.
//   2. Pick `setup` in the toolbar's function menu and press Run (approve the permissions). It
//      creates the Attendance file in your Drive; its link is in the execution log.
//   3. Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).
//      Updating later: Deploy -> Manage deployments -> edit -> Version: New version, so the
//      URL stays the same.
//
// The site sends JSON with an `action`: entry (a solo / team registration; "register" from older
// site versions), checkin, lookup, walkin, stats.
// An entry is solo or a team of two: one row per person, each with their own pass, teammates
// sharing a team_id.

// the team columns come last, so a sheet made before teams existed keeps lining up (its header
// row is extended automatically)
const HEADERS = ["submitted_at", "pass_id", "name", "rrn", "dept", "section", "year", "phone", "entry", "team_name", "teammate", "team_id"];
// the attendance file has the same details, with the check-in time first
const ATT_HEADERS = ["checked_in_at", "pass_id", "name", "rrn", "dept", "section", "year", "phone", "entry", "team_name", "teammate", "team_id"];
// Leave "" to let setup() create the attendance file, or paste the ID of an existing Google
// Sheet (the long part of its link between /d/ and /edit).
const ATTENDANCE_SHEET_ID = "";
const TZ = "Asia/Kolkata";
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "bad request" });
  }
  // one request at a time: two people registering (or two scanners) must not race each other
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json({ ok: false, busy: true, error: "busy" });
  try {
    switch (data.action || "register") {
      case "entry": // the site's solo / team registrations
      case "register": // older site versions
        return json(register(data));
      case "checkin":
        return json(checkIn(data));
      case "lookup":
        return json(lookup(data));
      case "walkin":
        return json(walkIn(data));
      case "stats":
        return json(Object.assign({ ok: true }, stats()));
      default:
        return json({ ok: false, error: "unknown action" });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser shows this: a quick "is it deployed?" check.
function doGet() {
  return json(Object.assign({ ok: true, service: "ENCLAVE registrations" }, stats()));
}

/** Run once from the editor: creates both tabs/files and logs the attendance file's link. */
function setup() {
  registrations();
  Logger.log("Attendance sheet: " + attendance().getParent().getUrl());
}

// ---- actions

/**
 * rows: one (solo) or two (a team; the first is the person registering), sent by the site.
 * An RRN that is already in gets that person's entry back instead of a second one; a teammate
 * who is already registered elsewhere is refused ({ taken: "1.rrn" }).
 */
function register(data) {
  const sheet = registrations();
  const rows = data.rows || [data]; // a site from before teams sent one flat row
  const mine = findRow(sheet, HEADERS, "rrn", up(rows[0].rrn));
  if (mine) return Object.assign({ ok: true, duplicate: true }, entryOf(sheet, mine));
  if (rows[1] && findRow(sheet, HEADERS, "rrn", up(rows[1].rrn))) return { ok: true, taken: "1.rrn" };

  rows.forEach(function (row, i) {
    let id = row.pass_id || newCode("ENC");
    while (findRow(sheet, HEADERS, "pass_id", id) || (i > 0 && id === rows[0].pass_id)) id = newCode("ENC");
    row.pass_id = id;
    row.submitted_at = stamp(row.submitted_at);
  });
  if (rows[0].team_id) {
    let team = rows[0].team_id;
    while (findRow(sheet, HEADERS, "team_id", team)) team = newCode("TM");
    rows.forEach(function (row) {
      row.team_id = team;
    });
  }
  rows.forEach(function (row) {
    appendText(sheet, HEADERS, row);
  });
  return {
    ok: true,
    duplicate: false,
    entry: rows[0].team_id ? "team" : "solo",
    teamName: rows[0].team_name || "",
    passes: rows.map(pass),
  };
}

function checkIn(data) {
  const passId = passOf(data.passId);
  const reg = passId && findRow(registrations(), HEADERS, "pass_id", passId);
  if (!reg) return Object.assign({ ok: true, status: "unknown", passId: passId }, stats());
  return mark(reg);
}

/** Pass ID or RRN -> the registrant, whether they are already in, and their team. */
function lookup(data) {
  const query = String(data.query || "").trim().toUpperCase();
  const passId = passOf(query);
  const reg = findRow(registrations(), HEADERS, passId ? "pass_id" : "rrn", passId || query);
  if (!reg) return { ok: true, found: false };
  const seen = findRow(attendance(), ATT_HEADERS, "pass_id", reg.pass_id);
  return { ok: true, found: true, person: full(reg), at: seen ? seen.checked_in_at : null, team: teamOf(reg) };
}

/** Someone without a pass (Google Form registrants, walk-ins): recorded by their RRN. */
function walkIn(data) {
  const p = data.person || {};
  const rrn = up(p.rrn);
  const reg = rrn && findRow(registrations(), HEADERS, "rrn", rrn);
  if (reg) return mark(reg); // they did register: check in their pass instead
  const att = attendance();
  const seen = rrn && findRow(att, ATT_HEADERS, "rrn", rrn);
  const who = {
    pass_id: "WALK-IN",
    name: p.name,
    rrn: rrn,
    dept: p.dept,
    section: p.section,
    year: p.year,
    phone: p.phone,
    entry: p.team_name ? "Team" : "Solo",
    team_name: p.team_name || "",
  };
  if (seen) return Object.assign({ ok: true, status: "already", at: seen.checked_in_at, person: full(seen) }, stats());
  const at = stamp();
  appendText(att, ATT_HEADERS, Object.assign({ checked_in_at: at }, who));
  return Object.assign({ ok: true, status: "checked_in", at: at, person: full(who) }, stats());
}

function mark(reg) {
  const att = attendance();
  const seen = findRow(att, ATT_HEADERS, "pass_id", reg.pass_id);
  let status = "already";
  let at = seen ? seen.checked_in_at : "";
  if (!seen) {
    status = "checked_in";
    at = stamp();
    appendText(att, ATT_HEADERS, Object.assign({}, reg, { checked_in_at: at }));
  }
  return Object.assign({ ok: true, status: status, at: at, person: full(reg), team: teamOf(reg) }, stats());
}

function stats() {
  const reg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registrations");
  return {
    registered: reg ? Math.max(0, reg.getLastRow() - 1) : 0,
    checkedIn: Math.max(0, attendance().getLastRow() - 1),
  };
}

// ---- teams

/** A person's whole entry: their pass first, then their teammate's. */
function entryOf(sheet, row) {
  const mate = mateOf(sheet, row);
  return {
    entry: row.team_id ? "team" : "solo",
    teamName: row.team_name || "",
    passes: mate ? [pass(row), pass(mate)] : [pass(row)],
  };
}

function mateOf(sheet, row) {
  if (!row.team_id) return null;
  const both = findRows(sheet, HEADERS, "team_id", row.team_id);
  for (let i = 0; i < both.length; i++) if (both[i].pass_id !== row.pass_id) return both[i];
  return null;
}

/** For the scanner: the team's name and the teammate, with when they checked in (or null). */
function teamOf(reg) {
  if (!reg.team_id) return null;
  const mate = mateOf(registrations(), reg);
  const seen = mate && findRow(attendance(), ATT_HEADERS, "pass_id", mate.pass_id);
  return {
    name: reg.team_name,
    mate: mate ? { name: mate.name, passId: mate.pass_id, at: seen ? seen.checked_in_at : null } : null,
  };
}

// ---- sheets

function registrations() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName("Registrations") || book.insertSheet("Registrations");
  prepare(sheet, HEADERS);
  return sheet;
}

function attendance() {
  const props = PropertiesService.getScriptProperties();
  const id = ATTENDANCE_SHEET_ID || props.getProperty("ATTENDANCE_SHEET_ID");
  let book;
  if (id) {
    book = SpreadsheetApp.openById(id);
  } else {
    book = SpreadsheetApp.create("ENCLAVE Attendance");
    props.setProperty("ATTENDANCE_SHEET_ID", book.getId());
  }
  let sheet = book.getSheetByName("Attendance");
  if (!sheet) {
    const only = book.getSheets();
    sheet = only.length === 1 && only[0].getLastRow() === 0 ? only[0].setName("Attendance") : book.insertSheet("Attendance");
  }
  prepare(sheet, ATT_HEADERS);
  return sheet;
}

/** A bold, frozen header row; an older one that is a shorter version of `headers` is extended. */
function prepare(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  const width = sheet.getLastColumn();
  if (width >= headers.length) return;
  const have = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  if (have.every((h, i) => h === headers[i])) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  }
}

/** Append a row written as plain text, so RRNs and phone numbers keep their leading zeros. */
function appendText(sheet, headers, row) {
  const at = sheet.getLastRow() + 1;
  if (at > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 200);
  const range = sheet.getRange(at, 1, 1, headers.length);
  range.setNumberFormat("@");
  range.setValues([headers.map((key) => (row[key] == null ? "" : String(row[key])))]);
}

/** Every data row whose `key` column equals `value` (whole cell, any case), as objects. */
function findRows(sheet, headers, key, value) {
  const last = sheet.getLastRow();
  if (last < 2 || !value) return [];
  const col = headers.indexOf(key) + 1;
  const cells = sheet
    .getRange(2, col, last - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .matchCase(false)
    .findAll();
  return cells.map(function (cell) {
    const values = sheet.getRange(cell.getRow(), 1, 1, headers.length).getDisplayValues()[0];
    const out = {};
    headers.forEach((h, i) => (out[h] = values[i]));
    return out;
  });
}

function findRow(sheet, headers, key, value) {
  return findRows(sheet, headers, key, value)[0] || null;
}

// ---- helpers

/** "ENCLAVE:ENC-7Q4KD", "enc-7q4kd" -> "ENC-7Q4KD" ("" if it isn't a pass). */
function passOf(raw) {
  const m = String(raw || "").toUpperCase().match(/ENC-[23456789A-HJ-NP-Z]{5}/);
  return m ? m[0] : "";
}

function newCode(prefix) {
  let id = "";
  for (let i = 0; i < 5; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return prefix + "-" + id;
}

/** India time, readable in the sheet: "2026-10-16 09:42:13". */
function stamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  return Utilities.formatDate(isNaN(d) ? new Date() : d, TZ, "yyyy-MM-dd HH:mm:ss");
}

const up = (value) => String(value || "").trim().toUpperCase();
const pass = (r) => ({ passId: r.pass_id, name: r.name, dept: r.dept, section: r.section, year: r.year });
const full = (r) => ({ passId: r.pass_id, name: r.name, rrn: r.rrn, dept: r.dept, section: r.section, year: r.year, team: r.team_name || "" });

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
