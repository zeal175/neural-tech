"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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

const ALL_FIELDS = fieldsFor("team");
const fieldByKey = (key) => ALL_FIELDS.find((f) => f.key === key);
const OTHER = "__other";
const EMPTY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, ""]));
const ENTRIES = [
  ["solo", "Solo"],
  ["team", "Team of 2"],
];

export default function RegisterForm() {
  const [entry, setEntry] = useState("solo");
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

  const switchEntry = (next) => {
    if (next === entry) return;
    setEntry(next);
    const keep = new Set(fieldsFor(next).map((f) => f.key));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => keep.has(k))));
    setServerError("");
  };

  const onProof = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((e) => ({ ...e, payment: "That image is too large (max 5 MB)." }));
      return;
    }
    setProof(file);
    setErrors((e) => ({ ...e, payment: undefined }));
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
      const ok = f.check(values[f.key]);
      if (ok !== true) found[f.key] = ok;
    }
    const rrn = (m) => values[`${m}.rrn`].trim().toUpperCase();
    if (entry === "team" && !found["1.rrn"] && rrn(1) === rrn(0)) found["1.rrn"] = "That’s your RRN. Add your teammate’s.";
    // payment is required for first-time entries; the server skips it when the RRN is already on file
    setServerError("");
    if (Object.keys(found).length) {
      setErrors(found);
      focusField(Object.keys(found)[0]);
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
      setEntry("solo");
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
      } else setServerError(data.error || "Couldn’t send that. Try again.");
    }
  };

  const resetSomeoneElse = () => {
    clearPass();
    setPass(null);
    setValues(EMPTY);
    setOther({});
    setEntry("solo");
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
      <p className="en-kicker">Registration</p>
      <h1 className="en-display reg-page-title">Enter the {EVENT.name}</h1>
      <p className="en-copy reg-page-lead">
        {WHEN_WHERE}. Fee {EVENT.fee}. Come solo or as a team of two — one form, a pass each. Pay via UPI, upload the
        screenshot, and claim your pass.
      </p>

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
          <div className="reg-entry-toggle col-span-2" role="radiogroup" aria-label="Entry">
            {ENTRIES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={entry === key}
                onClick={() => switchEntry(key)}
                className={`reg-entry-btn ${entry === key ? "is-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

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
            const heading =
              entry === "team" && f.name === "name" ? (
                <p className={`reg-member col-span-2 ${f.member ? "is-mate" : ""}`}>{f.member ? "Your teammate" : "You"}</p>
              ) : null;
            return (
              <Fragment key={f.key}>
                {heading}
                <label className={`reg-field ${f.span === 2 ? "col-span-2" : ""}`}>
                  <span className="mono-label text-cream/55">{f.label}</span>
                  {f.type === "select" ? (
                    <>
                      <select
                        name={f.key}
                        value={typing ? OTHER : values[f.key]}
                        className={!typing && !values[f.key] ? "is-empty" : undefined}
                        onChange={(e) => pick(f, e.target.value)}
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
                        <input {...textProps} type="text" autoComplete="off" placeholder={f.other} data-other={f.key} aria-label={f.label} />
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
            <p className="en-kicker">Pay {EVENT.fee}</p>
            <h2 className="reg-pay-title">UPI QR code</h2>
            <p className="en-copy">
              Scan this QR with any UPI app, pay {EVENT.fee}
              {EVENT.upiVpa ? ` to ${EVENT.upiVpa}` : ""}, then upload the payment screenshot below.
            </p>

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
                    <span className="reg-pay-qr-hint">Tap to enlarge or save</span>
                  </button>
                ) : (
                  <p className="reg-error" role="alert">
                    Drop your UPI QR at <code>public/enclave/upi-qr.png</code>
                  </p>
                )}
              </div>
              <div className="reg-pay-meta">
                <p className="en-kicker">Amount</p>
                <p className="reg-pay-amount">{EVENT.fee}</p>
                {EVENT.upiVpa ? (
                  <>
                    <p className="en-kicker">UPI ID</p>
                    <p className="reg-pay-vpa">{EVENT.upiVpa}</p>
                  </>
                ) : null}
              </div>
            </div>

            <label className="reg-field reg-pay-upload" data-field="payment">
              <span className="mono-label text-cream/55">Payment screenshot</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                onChange={(e) => onProof(e.target.files?.[0] || null)}
                aria-invalid={!!errors.payment}
              />
              {proof ? (
                <div className="reg-pay-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {proofPreview ? <img src={proofPreview} alt="Payment screenshot preview" /> : null}
                  <button type="button" className="reg-pay-change" onClick={() => fileInput.current?.click()}>
                    Change image
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

          <button type="submit" className="cta col-span-2 mt-2 justify-center" disabled={status === "submitting"}>
            {status === "submitting" ? "Saving…" : entry === "team" ? "Claim our passes" : "Claim my pass"}
            <span className="cta-dot" />
          </button>
          <p className="col-span-2 text-center text-[0.78rem] leading-[1.5] text-cream/45">
            Already registered? Enter your details again with the same RRN — you’ll get your pass back without paying
            twice.
          </p>
        </form>
      )}
    </div>
  );
}
