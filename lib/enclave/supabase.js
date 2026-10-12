/** Thin Supabase REST + Storage helpers (service role). */

export function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function base() {
  return process.env.SUPABASE_URL.replace(/\/$/, "");
}

function key() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function headers(extra = {}) {
  return {
    apikey: key(),
    Authorization: `Bearer ${key()}`,
    ...extra,
  };
}

export async function sbFetch(path, init = {}) {
  const { headers: extra, ...rest } = init;
  return fetch(`${base()}${path}`, {
    ...rest,
    headers: headers(extra || {}),
    cache: "no-store",
  });
}

/** REST select. Returns parsed JSON array or throws. */
export async function sbSelect(table, query) {
  const response = await sbFetch(`/rest/v1/${table}?${query}`, {
    headers: { Prefer: "return=representation" },
  });
  if (!response.ok) throw new Error("supabase");
  return response.json();
}

/** REST insert rows. Returns inserted rows. */
export async function sbInsert(table, rows) {
  const response = await sbFetch(`/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (/duplicate|unique/i.test(text)) throw new Error("duplicate");
    throw new Error("supabase");
  }
  return response.json();
}

/** Upload a file to a private storage bucket. path is the object key. */
export async function sbUpload(bucket, objectPath, bytes, contentType) {
  const response = await sbFetch(`/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!response.ok) throw new Error("storage");
  return objectPath;
}

/** Signed URL to open a private object (seconds). */
export async function sbSignedUrl(bucket, objectPath, expiresIn = 3600) {
  const response = await sbFetch(`/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error("storage");
  const data = await response.json();
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw new Error("storage");
  return signed.startsWith("http") ? signed : `${base()}/storage/v1${signed}`;
}
