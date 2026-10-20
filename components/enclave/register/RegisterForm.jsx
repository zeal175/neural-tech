"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { compressProof, MAX_PROOF_BYTES } from "@/lib/enclave/compressProof";
import { DEPARTMENTS, EVENT, SECTIONS, WHEN_WHERE, YEARS } from "@/lib/enclave/event";
import EnclavePass from "./EnclavePass";
import { clearPass, loadPass, savePass } from "./passStorage";

const FIELDS = [
  {
    name: "name",
    label: "Full name",
    autoComplete: "name",
    placeholder: "Your name",
    matePlaceholder: "Their name",
    span: 2,
    caps: "words",
    check: (v, you) => v.trim().length >= 2 || (you ? "Add your name so we know who you are." : "Add your teammate’s name."),
  },
  {
    name: "rrn",
    label: "RRN",
    placeholder: "Register number",
    span: 2,
    upper: true,
    caps: "characters",
    check: (v, you) => v.trim().length >= 4 || (you ? "Add your RRN." : "Add your teammate’s RRN."),
  },
  {
    name: "dept",
    label: "Department",
    type: "select",
    options: DEPARTMENTS,
    other: "Type the department",
    caps: "characters",
    check: (v, you) => v.trim().length >= 2 || (you ? "Pick your department." : "Pick their department."),
  },
  {
    name: "section",
    label: "Section",
    type: "select",
    options: SECTIONS,
    other: "Type the section",
    upper: true,
    caps: "characters",
    check: (v, you) => v.trim().length >= 1 || (you ? "Pick your section." : "Pick their section."),
  },
  {
    name: "year",
    label: "Year",
    type: "select",
    options: YEARS,
    check: (v, you) => YEARS.includes(v) || (you ? "Pick the year you’re in." : "Pick their year."),
  },
  {
    name: "phone",
    label: "Phone",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
    placeholder: "98765 43210",
    check: (v, you) =>
      /^\d{10,13}$/.test(v.replace(/\D/g, "")) || (you ? "Add a valid phone number." : "Add a valid number for them."),
  },
];

const TEAM_NAME = {
  key: "teamName",
  name: "teamName",
  label: "Team name",
  placeholder: "What should we call you two?",
  span: 2,
  caps: "words",
  check: (v) => v.trim().length >= 2 || "Give your team a name.",
};

function fieldsFor(entry) {
  const members = entry === "team" ? [0, 1] : [0];
  const people = members.flatMap((m) =>
    FIELDS.map((f) => ({
      ...f,
      key: `${m}.${f.name}`,
      member: m,
      placeholder: m ? f.matePlaceholder || f.placeholder : f.placeholder,
      autoComplete: m ? "off" : f.autoComplete,
      check: (v) => f.check(v, m === 0),
    })),
  );
  return entry === "team" ? [TEAM_NAME, ...people] : people;
}

const ALL_FIELDS = fieldsFor("solo");
const fieldByKey = (key) => ALL_FIELDS.find((f) => f.key === key);
const OTHER = "__other";
const EMPTY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, ""]));

export default function RegisterForm() {
  const entry = "solo";
  const fields = fieldsFor(entry);
  const lastKey = fields[fields.length - 1].key;
  const [values, setValues] = useState(EMPTY);
  const [other, setOther] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(EVENT.registrationOpen ? "idle" : "closed");
  const [serverError, setServerError] = useState("");
  const [pass, setPass] = useState(null);
  const [proof, setProof] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [qrOk, setQrOk] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const honeypot = useRef(null);
  const firstField = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    const saved = loadPass();
    if (saved) setPass({ ...saved, returning: true });
  }, []);

  useEffect(() => {
    if (!proof) {
      setProofPreview("");
      return;
    }
    const url = URL.createObjectURL(proof);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proof]);

  useEffect(() => {
    if (!qrOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setQrOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [qrOpen]);

  const update = (key, raw) => {
    const field = fieldByKey(key);
    const value = field?.upper ? raw.toUpperCase() : raw;
    const next = { ...values, [key]: value };
    setValues(next);
    if (errors[key] && field.check(value) === true) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pick = (f, value) => {
    const typing = value === OTHER;
    setOther((o) => ({ ...o, [f.key]: typing }));
    update(f.key, typing ? "" : value);
  };

  const onProof = async (file) => {
    if (!file) {
      setProof(null);
      setErrors((e) => ({ ...e, payment: "Upload a screenshot of your UPI payment." }));
      return;
    }
    try {
      const ready = await compressProof(file);
      if (ready.size > MAX_PROOF_BYTES) {
        setErrors((e) => ({ ...e, payment: "That image is too large (max 4 MB). Try a cropped screenshot." }));
        return;
      }
      setProof(ready);
      setErrors((e) => ({ ...e, payment: undefined }));
    } catch (err) {
      setProof(null);
      setErrors((e) => ({
        ...e,
        payment: err?.message || "Couldn’t read that image. Try a JPG or PNG screenshot.",
      }));
    }
  };

  const focusField = (name) => {
    const el =
      document.querySelector(`[data-other="${name}"]`) || document.querySelector(`[name="${name}"]`) || document.querySelector(`[data-field="${name}"]`);
    el?.focus?.();
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (status === "submitting") return;

    const found = {};
    for (const f of fields) {
      const ok = f.check(values[f.key] ?? "");
      if (ok !== true) found[f.key] = ok;
    }
    if (!proof) found.payment = "Upload a screenshot of your UPI payment.";
    setServerError("");
    if (Object.keys(found).length) {
      setErrors(found);
      const first = Object.keys(found)[0];
      if (first === "payment") {
        fileInput.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
        fileInput.current?.focus?.();
      } else focusField(first);
      return;
    }

    setStatus("submitting");
    const person = (m) => Object.fromEntries(FIELDS.map((f) => [f.name, values[`${m}.${f.name}`]]));
    const team = entry === "team";
    const form = new FormData();
    form.set("entry", entry);
    form.set("teamName", team ? values.teamName : "");
    form.set("members", JSON.stringify(team ? [person(0), person(1)] : [person(0)]));
    form.set("company", honeypot.current?.value || "");
    form.set("payment", proof);

    let res = null;
    let data = {};
    try {
      res = await fetch("/enclave/api/register", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout?.(45000),
      });
      data = await res.json().catch(() => ({}));
      if (res.status === 413) {
        data = {
          ok: false,
          field: "payment",
          error: "That screenshot is too large for upload. Try a cropped JPG under 4 MB.",
        };
      } else if (res.status === 504) {
        data = {
          ok: false,
          error: data.error || "The server timed out. Wait a moment and claim again — you won’t be registered twice.",
        };
      }
    } catch (err) {
      data = {
        ok: false,
        error:
          err?.name === "TimeoutError"
            ? "That’s taking too long. Check your internet and try again."
            : "No connection. Check your internet and try again.",
      };
    }

    if (data.ok && data.passes?.length) {
      const saved = { entry: data.entry === "team" ? "team" : "solo", teamName: data.teamName || "", passes: data.passes };
      savePass(saved);
      setValues(EMPTY);
      setOther({});
      setProof(null);
      setStatus("idle");
      setPass({ ...saved, returning: !!data.duplicate });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (res?.status === 503) setStatus("unconfigured");
    else if (res?.status === 410) setStatus("closed");
    else {
      setStatus("idle");
      if (data.field && fieldByKey(data.field)) {
        setErrors({ [data.field]: data.error });
        focusField(data.field);
      } else if (data.field === "payment") {
        setErrors({ payment: data.error });
        fileInput.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      } else setServerError(data.error || "Couldn’t send that. Try again.");
    }
  };

  const resetSomeoneElse = () => {
    clearPass();
    setPass(null);
    setValues(EMPTY);
    setOther({});
    setProof(null);
    setErrors({});
    setServerError("");
    setStatus(EVENT.registrationOpen ? "idle" : "closed");
    requestAnimationFrame(() => firstField.current?.focus());
  };

  if (pass) {
    return (
      <div className="reg-page-pass">
        <EnclavePass entry={pass} onDone={() => (window.location.href = "/enclave")} onReset={resetSomeoneElse} />
      </div>
    );
  }

  return (
    <div className="reg-page-body">
      <header className="reg-page-head">
        <p className="en-kicker">Registration</p>
        <h1 className="en-display reg-page-title">{EVENT.name}</h1>
        <p className="en-copy reg-page-lead">
          {WHEN_WHERE} · {EVENT.fee}. Solo or duo — register individually; teams are formed on the day.
        </p>
      </header>

      {status === "unconfigured" || status === "closed" ? (
        <div className="reg-page-notice">
          <p>{status === "closed" ? "Registrations are closed." : "The on-site form isn’t connected yet."}</p>
          {EVENT.googleFormUrl && status !== "closed" ? (
            <a href={EVENT.googleFormUrl} target="_blank" rel="noreferrer" className="en-exit-cta">
              Register via Google Form →
            </a>
          ) : null}
        </div>
      ) : (
        <form className="reg-form reg-page-form" onSubmit={submit} noValidate>
          {fields.map((f) => {
            const typing = !!other[f.key];
            const err = errors[f.key];
            const errId = `err-${f.key.replace(".", "-")}`;
            const textProps = {
              name: f.key,
              value: values[f.key],
              autoCapitalize: f.caps || "off",
              autoCorrect: "off",
              spellCheck: false,
              enterKeyHint: f.key === lastKey ? "next" : "next",
              onChange: (e) => update(f.key, e.target.value),
              "aria-invalid": !!err,
              "aria-describedby": err ? errId : undefined,
            };
            return (
              <Fragment key={f.key}>
                <label className={`reg-field ${f.span === 2 ? "col-span-2" : ""}`}>
                  <span className="mono-label text-cream/55">{f.label}</span>
                  {f.type === "select" ? (
                    <>
                      <select
                        name={f.key}
                        value={typing ? OTHER : values[f.key]}
                        className={!typing && !values[f.key] ? "is-empty" : undefined}
                        onChange={(e) => pick(f, e.target.value)}
                        required={!typing}
                        aria-required="true"
                        aria-invalid={!typing && !!err}
                        aria-describedby={!typing && err ? errId : undefined}
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        {f.other ? <option value={OTHER}>Other</option> : null}
                      </select>
                      {typing ? (
                        <input
                          {...textProps}
                          type="text"
                          autoComplete="off"
                          placeholder={f.other}
                          data-other={f.key}
                          aria-label={f.label}
                          required
                          aria-required="true"
                        />
                      ) : null}
                    </>
                  ) : (
                    <input
                      {...textProps}
                      ref={f.key === "0.name" ? firstField : undefined}
                      type={f.type || "text"}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete || "off"}
                      inputMode={f.inputMode}
                      required
                      aria-required="true"
                    />
                  )}
                  {err ? (
                    <span id={errId} className="reg-error" role="alert">
                      {err}
                    </span>
                  ) : null}
                </label>
              </Fragment>
            );
          })}

          <section className="reg-pay col-span-2" aria-label="Payment">
            <div className="reg-pay-head">
              <p className="en-kicker">Payment</p>
              <p className="reg-pay-amount">{EVENT.fee}</p>
            </div>

            <div className="reg-pay-grid">
              <div className="reg-pay-qr">
                {qrOk ? (
                  <button
                    type="button"
                    className="reg-pay-qr-btn"
                    onClick={() => setQrOpen(true)}
                    aria-label="Open UPI QR full screen"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={EVENT.upiQr}
                      alt="UPI payment QR code"
                      width={280}
                      height={280}
                      onError={() => setQrOk(false)}
                    />
                  </button>
                ) : (
                  <p className="reg-error" role="alert">
                    Drop your UPI QR at <code>public/enclave/upi-qr.png</code>
                  </p>
                )}
              </div>
              {EVENT.upiVpa ? <p className="reg-pay-vpa">{EVENT.upiVpa}</p> : null}
            </div>

            <label className="reg-field reg-pay-upload" data-field="payment">
              <span className="mono-label text-cream/55">Payment screenshot</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                required={!proof}
                aria-required="true"
                onChange={(e) => onProof(e.target.files?.[0] || null)}
                aria-invalid={!!errors.payment}
              />
              {proof ? (
                <div className="reg-pay-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {proofPreview ? <img src={proofPreview} alt="Payment screenshot preview" /> : null}
                  <button type="button" className="reg-pay-change" onClick={() => fileInput.current?.click()}>
                    Change
                  </button>
                </div>
              ) : null}
              {errors.payment ? (
                <span className="reg-error" role="alert">
                  {errors.payment}
                </span>
              ) : null}
            </label>
          </section>

          {qrOpen && qrOk ? (
            <div className="reg-qr-viewer" role="dialog" aria-modal="true" aria-label="UPI QR code">
              <button type="button" className="reg-qr-scrim" aria-label="Close" onClick={() => setQrOpen(false)} />
              <div className="reg-qr-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={EVENT.upiQr} alt="UPI payment QR code" />
                <div className="reg-qr-actions">
                  <a className="cta" href={EVENT.upiQr} download="enclave-upi-qr.png" target="_blank" rel="noreferrer">
                    Save QR
                    <span className="cta-dot" />
                  </a>
                  <button type="button" className="pill-ghost" onClick={() => setQrOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <input ref={honeypot} name="company" tabIndex={-1} autoComplete="off" className="reg-hp" aria-hidden="true" />

          {serverError ? (
            <p className="reg-error col-span-2" role="alert">
              {serverError}
            </p>
          ) : null}

          <button type="submit" className="reg-submit col-span-2" disabled={status === "submitting"}>
            {status === "submitting" ? "Saving…" : "Claim pass"}
          </button>
          <p className="reg-footnote col-span-2">Same RRN returns your pass.</p>
        </form>
      )}
    </div>
  );
}
