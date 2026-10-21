// Organizer check-in API (used by /checkin). Every request carries the organizer PIN
// (CHECKIN_PIN) in the x-checkin-pin header; registrants' details never leave without it.
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { checkIn, lookup, stats, walkIn } from "@/lib/enclave/attendance";
import { YEARS } from "@/lib/enclave/event";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const misses = new Map();
const fail = (status, error) => NextResponse.json({ ok: false, error }, { status });
const clean = (value, max = 80) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

function clientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// hashes compare in constant time whatever the lengths
const digest = (s) => createHash("sha256").update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
const pinMatches = (given) => same(given, process.env.CHECKIN_PIN);

// An organizer phone that has unlocked with the right PIN gets this cookie: a signature only the
// PIN can produce (so it can't be faked, and changing the PIN voids it). Such a phone skips the
// wrong-PIN pause below, so someone guessing PINs on the venue Wi-Fi (one shared IP) can't lock
// the door team out.
const TRUSTED = "enclave-door";
const trustToken = () => createHmac("sha256", process.env.CHECKIN_PIN).update("enclave-checkin-device").digest("hex");
const isTrusted = (request) => {
  const token = request.cookies.get(TRUSTED)?.value;
  return !!token && same(token, trustToken());
};

/** Wrong PINs: 8 tries per minute per IP, then a pause. */
function tooManyMisses(ip, missed) {
  const now = Date.now();
  const recent = (misses.get(ip) || []).filter((t) => now - t < 60_000);
  if (missed) recent.push(now);
  misses.set(ip, recent);
  return recent.length > 8;
}

export async function POST(request) {
  if (!process.env.CHECKIN_PIN) return fail(503, "Check-in isn’t set up yet: add CHECKIN_PIN to the site’s environment variables.");
  const ip = clientIp(request);
  const trusted = isTrusted(request);
  if (!trusted && tooManyMisses(ip, false)) return fail(429, "Too many wrong PINs. Wait a minute.");
  if (!pinMatches(request.headers.get("x-checkin-pin") || "")) {
    if (!trusted) tooManyMisses(ip, true);
    return fail(401, "Wrong PIN.");
  }
  // right PIN: answer, and mark this phone as the door team's (for 30 days)
  const answer = (data) => {
    const res = NextResponse.json(data);
    if (!trusted) {
      res.cookies.set(TRUSTED, trustToken(), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/enclave/api/checkin",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  };

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") return fail(400, "Bad request.");

  try {
    switch (body.action) {
      case "stats":
        return answer(await stats());
      case "checkin":
        return answer(await checkIn(clean(body.passId, 40)));
      case "lookup":
        return answer(await lookup(clean(body.query, 40)));
      case "walkin": {
        const p = body.person || {};
        const person = {
          name: clean(p.name),
          rrn: clean(p.rrn, 24).toUpperCase(),
          dept: clean(p.dept),
          section: clean(p.section, 12).toUpperCase(),
          year: YEARS.includes(p.year) ? p.year : "",
          phone: clean(p.phone, 24).replace(/[^\d+]/g, ""),
          team_name: clean(p.team_name, 40), // optional: one of a team, at the desk
        };
        if (person.name.length < 2 || person.rrn.length < 4) return fail(400, "Add at least their name and RRN.");
        return answer(await walkIn(person));
      }
      default:
        return fail(400, "Unknown action.");
    }
  } catch (error) {
    if (error.message === "unconfigured") {
      return fail(
        503,
        "Check-in isn’t connected. Add Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) or REGISTRATIONS_WEBHOOK_URL.",
      );
    }
    if (error.message === "timeout") return fail(504, "Attendance is slow right now. Try again.");
    if (error.message === "supabase") return fail(502, "Couldn’t reach the attendance database. Try again.");
    console.error("checkin failed", error);
    return fail(502, "Couldn’t save attendance. Try again.");
  }
}
