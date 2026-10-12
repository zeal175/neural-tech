// Registration endpoint. Multipart form: entry fields + payment screenshot.
// Solo registration; each person gets an ENCLAVE pass.
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { EVENT, YEARS } from "@/lib/enclave/event";
import { checkPaymentImage } from "@/lib/enclave/payment-check";
import { findEntryByRrn, savePaymentProof, saveRegistration } from "@/lib/enclave/save-registration";

export const maxDuration = 30;

const YEAR_SET = new Set(YEARS);
const hits = new Map();
const LIMIT = 30;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const MAX_PROOF = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function clientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function clean(value, max = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function code(prefix) {
  const bytes = randomBytes(5);
  let id = "";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${id}`;
}
const passId = () => code("ENC");

const fail = (status, field, error) => NextResponse.json({ ok: false, field, error }, { status });

function member(given) {
  const raw = given && typeof given === "object" ? given : {};
  return {
    name: clean(raw.name, 80),
    rrn: clean(raw.rrn, 24).toUpperCase(),
    dept: clean(raw.dept, 80),
    section: clean(raw.section, 12).toUpperCase(),
    year: clean(raw.year, 24),
    phone: clean(raw.phone, 24).replace(/[^\d+]/g, ""),
  };
}

function problem(m, i) {
  const you = i === 0;
  if (m.name.length < 2) return ["name", you ? "Add your name so we know who you are." : "Add your teammate’s name."];
  if (m.rrn.length < 4) return ["rrn", you ? "Add your RRN." : "Add your teammate’s RRN."];
  if (m.dept.length < 2) return ["dept", you ? "Pick your department." : "Pick your teammate’s department."];
  if (!m.section) return ["section", you ? "Pick your section." : "Pick your teammate’s section."];
  if (!YEAR_SET.has(m.year)) return ["year", you ? "Pick the year you’re in." : "Pick your teammate’s year."];
  if (!/^\d{10,13}$/.test(m.phone.replace(/\D/g, ""))) return ["phone", you ? "Add a valid phone number." : "Add a valid phone number for your teammate."];
  return null;
}

function extOf(file) {
  const fromName = (file.name || "").split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

async function parseBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    let members = [];
    const membersRaw = form.get("members");
    if (typeof membersRaw === "string") {
      try {
        members = JSON.parse(membersRaw);
      } catch {
        members = [];
      }
    }
    return {
      entry: clean(form.get("entry"), 12),
      teamName: clean(form.get("teamName"), 40),
      members,
      company: clean(form.get("company"), 80),
      proof: form.get("payment"),
    };
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  return {
    entry: clean(body.entry, 12),
    teamName: clean(body.teamName, 40),
    members: Array.isArray(body.members) ? body.members : [body],
    company: clean(body.company, 80),
    proof: null,
  };
}

export async function POST(request) {
  if (!EVENT.registrationOpen) return fail(410, null, "Registrations are closed.");
  if (limited(clientIp(request))) return fail(429, null, "Too many tries. Wait a minute and send again.");

  const body = await parseBody(request);
  if (!body) return fail(400, null, "That didn’t send. Try again.");

  if (body.entry === "team") return fail(400, null, "Registration is solo only.");

  const team = false;
  const members = (Array.isArray(body.members) ? body.members : []).slice(0, 1).map(member);
  const teamName = "";

  if (body.company) {
    const passes = members.map((m) => ({ passId: passId(), name: m.name, dept: m.dept, section: m.section, year: m.year }));
    return NextResponse.json({ ok: true, entry: "solo", teamName, passes, passId: passes[0]?.passId });
  }

  if (!members.length) return fail(400, "0.name", "Add your name so we know who you are.");
  for (const [i, m] of members.entries()) {
    const bad = problem(m, i);
    if (bad) return fail(400, `${i}.${bad[0]}`, bad[1]);
  }

  // already registered: hand their pass back without asking for another payment
  try {
    const existing = await findEntryByRrn(members[0].rrn);
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        entry: existing.entry,
        teamName: existing.teamName,
        passes: existing.passes,
        passId: existing.passes[0].passId,
        person: existing.passes[0],
      });
    }
  } catch {
    /* fall through to a normal save */
  }

  const proof = body.proof;
  if (!(proof instanceof File) || !proof.size) {
    return fail(400, "payment", "Upload a screenshot of your UPI payment.");
  }
  if (proof.size > MAX_PROOF) return fail(400, "payment", "That image is too large (max 5 MB).");
  if (proof.type && !ALLOWED_TYPES.has(proof.type)) {
    return fail(400, "payment", "Use a JPG, PNG, or WEBP screenshot.");
  }

  const now = new Date().toISOString();
  const teamId = team ? code("TM") : "";
  const rows = members.map((m, i) => ({
    submitted_at: now,
    pass_id: passId(),
    ...m,
    entry: team ? "Team" : "Solo",
    team_name: teamName,
    teammate: team ? members[1 - i].name : "",
    team_id: teamId,
    payment_path: "",
  }));
  if (team && rows[0].pass_id === rows[1].pass_id) rows[1].pass_id = passId();

  try {
    const bytes = Buffer.from(await proof.arrayBuffer());
    const check = await checkPaymentImage(bytes, { feeAmount: EVENT.upiAmount || "50" });
    if (!check.ok) return fail(400, "payment", check.error);

    const paymentPath = await savePaymentProof(rows[0].pass_id, {
      bytes,
      contentType: proof.type || "image/jpeg",
      ext: extOf(proof),
    });
    // one screenshot covers the whole entry (solo or team)
    for (const row of rows) row.payment_path = paymentPath;

    const saved = await saveRegistration(rows);
    if (saved.taken) {
      return fail(409, saved.taken, "Your teammate is already registered (solo or in another team). Each person can enter once.");
    }
    return NextResponse.json({
      ok: true,
      duplicate: saved.duplicate,
      entry: saved.entry,
      teamName: saved.teamName,
      passes: saved.passes,
      passId: saved.passes[0].passId,
      person: saved.passes[0],
    });
  } catch (error) {
    if (error.message === "unconfigured") {
      return fail(503, null, "The on-site form isn’t connected yet.");
    }
    if (error.message === "timeout") {
      return fail(504, null, "Lots of people are registering right now. Give it a few seconds and send again.");
    }
    if (error.message === "outdated") {
      return fail(502, null, "Registrations are being updated. Try again in a few minutes.");
    }
    if (error.message === "storage") {
      return fail(502, null, "Couldn’t save the payment screenshot. Try again.");
    }
    console.error("register failed", error);
    return fail(502, null, "Couldn’t save that. Try again.");
  }
}
