import { NextResponse } from "next/server";
import { listRegistrations } from "@/lib/save-registration";
import { sbSignedUrl, supabaseConfigured } from "@/lib/supabase";
import { PAYMENT_BUCKET } from "@/lib/save-registration";
import { readFile } from "fs/promises";
import path from "path";
import { PAYMENTS_DIR } from "@/lib/save-registration";

function pinOk(request) {
  const expected = process.env.ADMIN_PIN || process.env.CHECKIN_PIN || "";
  if (!expected) return false;
  const given = request.headers.get("x-admin-pin") || "";
  return given === expected;
}

export async function GET(request) {
  if (!pinOk(request)) {
    return NextResponse.json({ ok: false, error: "Wrong PIN." }, { status: 401 });
  }

  try {
    const rows = await listRegistrations(300);
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error.message === "unconfigured") {
      return NextResponse.json({ ok: false, error: "Storage isn’t connected." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Couldn’t load registrations." }, { status: 502 });
  }
}

/** Open a payment screenshot: ?path=... → redirect to signed URL or stream local file. */
export async function POST(request) {
  if (!pinOk(request)) {
    return NextResponse.json({ ok: false, error: "Wrong PIN." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const paymentPath = String(body?.path || "").trim();
  if (!paymentPath) return NextResponse.json({ ok: false, error: "Missing path." }, { status: 400 });

  try {
    if (paymentPath.startsWith("local:")) {
      const name = paymentPath.slice(6).replace(/[^a-zA-Z0-9._-]/g, "");
      const file = path.join(PAYMENTS_DIR, name);
      const bytes = await readFile(file);
      const ext = name.split(".").pop()?.toLowerCase();
      const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (!supabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "No storage." }, { status: 503 });
    }
    const url = await sbSignedUrl(PAYMENT_BUCKET, paymentPath, 3600);
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t open that screenshot." }, { status: 502 });
  }
}
