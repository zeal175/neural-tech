import { NextResponse } from "next/server";
import { saveRegistration } from "@/lib/save-registration";

const CLOSED = true;
const YEARS = new Set(["1st year", "2nd year", "3rd year", "4th year"]);
const hits = new Map();

function clientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) {
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

export async function POST(request) {
  if (CLOSED) {
    return NextResponse.json(
      { ok: false, error: "Registrations are closed. Contact us personally." },
      { status: 410 },
    );
  }

  if (limited(clientIp(request))) {
    return NextResponse.json({ ok: false, error: "Too many tries. Wait a minute and send again." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "That didn’t send. Try again." }, { status: 400 });
  }

  if (clean(body.company, 80)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, 80);
  const rrn = clean(body.rrn, 24).toUpperCase();
  const dept = clean(body.dept, 80);
  const section = clean(body.section, 12).toUpperCase();
  const year = clean(body.year, 24);
  const phone = clean(body.phone, 24).replace(/[^\d+]/g, "");
  const ntc = clean(body.ntc, 500);

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Add your name so we know who you are." }, { status: 400 });
  }
  if (rrn.length < 4) {
    return NextResponse.json({ ok: false, error: "Add your RRN." }, { status: 400 });
  }
  if (dept.length < 2) {
    return NextResponse.json({ ok: false, error: "Add your department." }, { status: 400 });
  }
  if (!section) {
    return NextResponse.json({ ok: false, error: "Add your section." }, { status: 400 });
  }
  if (!YEARS.has(year)) {
    return NextResponse.json({ ok: false, error: "Pick the year you’re in." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ ok: false, error: "Add a valid phone number." }, { status: 400 });
  }
  if (ntc.length < 4) {
    return NextResponse.json({ ok: false, error: "Tell us what you want to do in NTC." }, { status: 400 });
  }

  const row = {
    submitted_at: new Date().toISOString(),
    name,
    rrn,
    dept,
    section,
    year,
    phone,
    ntc,
  };

  try {
    await saveRegistration(row);
  } catch (error) {
    if (error.message === "unconfigured") {
      return NextResponse.json(
        { ok: false, error: "Registrations aren’t connected to a sheet or database yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn’t save that. Try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
