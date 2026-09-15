import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const HEADERS = ["submitted_at", "name", "rrn", "dept", "section", "year", "phone", "ntc"];

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvLine(row) {
  return HEADERS.map((key) => csvCell(row[key])).join(",") + "\n";
}

async function appendCsv(row) {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "registrations.csv");
  await mkdir(dir, { recursive: true });
  let existing = "";
  try {
    existing = await readFile(file, "utf8");
  } catch {
    existing = "";
  }
  if (!existing.trim() || existing.split("\n")[0].trim() !== HEADERS.join(",")) {
    await writeFile(file, HEADERS.join(",") + "\n" + csvLine(row), "utf8");
    return;
  }
  await appendFile(file, csvLine(row), "utf8");
}

async function postWebhook(row) {
  const response = await fetch(process.env.REGISTRATIONS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    throw new Error("webhook");
  }
}

async function postSupabase(row) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${base}/rest/v1/registrations`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    throw new Error("supabase");
  }
}

export async function saveRegistration(row) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await postSupabase(row);
    return "supabase";
  }

  const webhook = process.env.REGISTRATIONS_WEBHOOK_URL;
  if (webhook) {
    await postWebhook(row);
    return "sheet";
  }

  if (process.env.VERCEL === "1") {
    throw new Error("unconfigured");
  }

  await appendCsv(row);
  return "file";
}
