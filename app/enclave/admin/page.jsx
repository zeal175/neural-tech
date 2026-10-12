"use client";

import { useCallback, useState } from "react";
import SiteNav from "@/components/enclave/SiteNav";

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async (code) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/enclave/api/admin/registrations", {
        headers: { "x-admin-pin": code },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn’t load.");
        setAuthed(false);
        return;
      }
      setRows(data.rows || []);
      setAuthed(true);
    } catch {
      setError("No connection.");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const unlock = async (e) => {
    e.preventDefault();
    await load(pin.trim());
  };

  const openShot = async (paymentPath) => {
    if (!paymentPath) return;
    setError("");
    try {
      const res = await fetch("/enclave/api/admin/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": pin.trim(),
        },
        body: JSON.stringify({ path: paymentPath }),
      });
      const type = res.headers.get("content-type") || "";
      if (type.startsWith("image/")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setViewer({ url, revoke: true });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error || "Couldn’t open screenshot.");
        return;
      }
      setViewer({ url: data.url, revoke: false });
    } catch {
      setError("Couldn’t open screenshot.");
    }
  };

  const closeViewer = () => {
    if (viewer?.revoke && viewer.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  };

  return (
    <main className="reg-page">
      <SiteNav />
      <div className="reg-page-shell admin-shell">
        <p className="en-kicker">Organizers</p>
        <h1 className="en-display reg-page-title">Registrations</h1>

        {!authed ? (
          <form className="admin-unlock" onSubmit={unlock}>
            <label className="reg-field">
              <span className="mono-label text-cream/55">Admin PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
              />
            </label>
            {error ? (
              <p className="reg-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="cta justify-center" disabled={loading}>
              {loading ? "Checking…" : "Unlock"}
              <span className="cta-dot" />
            </button>
          </form>
        ) : (
          <>
            <div className="admin-toolbar">
              <p className="en-copy">{rows.length} entries</p>
              <button type="button" className="pill-ghost" onClick={() => load(pin.trim())} disabled={loading}>
                Refresh
              </button>
            </div>
            {error ? (
              <p className="reg-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Pass</th>
                    <th>Name</th>
                    <th>RRN</th>
                    <th>Entry</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.pass_id || row.id}>
                      <td>{row.submitted_at ? new Date(row.submitted_at).toLocaleString("en-IN") : "—"}</td>
                      <td className="mono">{row.pass_id}</td>
                      <td>
                        {row.name}
                        {row.team_name ? <span className="admin-soft"> · {row.team_name}</span> : null}
                      </td>
                      <td className="mono">{row.rrn}</td>
                      <td>{row.entry}</td>
                      <td>
                        {row.payment_path ? (
                          <button type="button" className="admin-shot" onClick={() => openShot(row.payment_path)}>
                            Open
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {viewer ? (
        <div className="admin-viewer" role="dialog" aria-modal="true" aria-label="Payment screenshot">
          <button type="button" className="admin-viewer-scrim" aria-label="Close" onClick={closeViewer} />
          <div className="admin-viewer-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer.url} alt="Payment screenshot" />
            <div className="admin-viewer-actions">
              <a href={viewer.url} target="_blank" rel="noreferrer" className="cta">
                Open in new tab
                <span className="cta-dot" />
              </a>
              <button type="button" className="pill-ghost" onClick={closeViewer}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
