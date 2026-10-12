"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { SHOW_FIGURE, emit, live, useHero } from "@/components/enclave/hero/heroStore";
import { DEPARTMENTS, EVENT, SECTIONS, WHEN_WHERE, YEARS } from "@/lib/enclave/event";
import EnclavePass from "./EnclavePass";
import { savePass } from "./passStorage";

// One person's details (asked once solo, twice for a team: you, then your teammate).
// caps: phone keyboards start in capitals (codes / sections); words: capitalise each word.
// Dropdowns with `other` end in an "Other" choice that opens a text box (placeholder: `other`).
// check(value, you): true, or the message (worded for "you" or "your teammate").
const FIELDS = [
  { name: "name", label: "Full name", autoComplete: "name", placeholder: "Your name", matePlaceholder: "Their name", span: 2, caps: "words",
    check: (v, you) => v.trim().length >= 2 || (you ? "Add your name so we know who you are." : "Add your teammate’s name.") },
  { name: "rrn", label: "RRN", placeholder: "Register number", span: 2, upper: true, caps: "characters",
    check: (v, you) => v.trim().length >= 4 || (you ? "Add your RRN." : "Add your teammate’s RRN.") },
  { name: "dept", label: "Department", type: "select", options: DEPARTMENTS, other: "Type the department", caps: "characters",
    check: (v, you) => v.trim().length >= 2 || (you ? "Pick your department." : "Pick their department.") },
  { name: "section", label: "Section", type: "select", options: SECTIONS, other: "Type the section", upper: true, caps: "characters",
    check: (v, you) => v.trim().length >= 1 || (you ? "Pick your section." : "Pick their section.") },
  { name: "year", label: "Year", type: "select", options: YEARS,
    check: (v, you) => YEARS.includes(v) || (you ? "Pick the year you’re in." : "Pick their year.") },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "98765 43210",
    privacy: true, check: (v, you) => /^\d{10,13}$/.test(v.replace(/\D/g, "")) || (you ? "Add a valid phone number." : "Add a valid number for them.") },
];
const TEAM_NAME = { key: "teamName", name: "teamName", label: "Team name", placeholder: "What should we call you two?", span: 2, caps: "words",
  check: (v) => v.trim().length >= 2 || "Give your team a name." };

/**
 * The form's fields in order. Each person's fields are keyed by member: "0.rrn" is yours,
 * "1.rrn" your teammate's (the same keys the server uses for its field errors).
 */
function fieldsFor(entry) {
  const members = entry === "team" ? [0, 1] : [0];
  const people = members.flatMap((m) =>
    FIELDS.map((f) => ({
      ...f,
      key: `${m}.${f.name}`,
      member: m,
      placeholder: m ? f.matePlaceholder || f.placeholder : f.placeholder,
      // the browser's autofill holds your details, not your teammate's
      autoComplete: m ? "off" : f.autoComplete,
      check: (v) => f.check(v, m === 0),
    }))
  );
  return entry === "team" ? [TEAM_NAME, ...people] : people;
}
const ALL_FIELDS = fieldsFor("solo");
const fieldByKey = (key) => ALL_FIELDS.find((f) => f.key === key);
const OTHER = "__other";
const coarse = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const EMPTY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, ""]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stage NDC of a viewport point (the hero stage is the gaze plane). */
function toStageNdc(x, y) {
  const stage = document.querySelector(".hero-stage");
  const r = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  return { x: ((x - r.left) / r.width) * 2 - 1, y: -(((y - r.top) / r.height) * 2 - 1) };
}

let measureCtx = null;
/** Where the text caret sits in an input, in viewport pixels (the figure watches it). */
function caretPoint(el) {
  const r = el.getBoundingClientRect();
  if (el.tagName === "SELECT") return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  measureCtx ||= document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  let pos = el.value.length;
  try {
    pos = el.selectionStart ?? pos;
  } catch {
    /* some input types don't expose a selection */
  }
  const w = measureCtx.measureText(el.value.slice(0, pos)).width;
  const x = r.left + parseFloat(cs.paddingLeft) + w - el.scrollLeft;
  return { x: Math.min(Math.max(x, r.left), r.right), y: r.top + r.height / 2 };
}

export default function RegisterPanel() {
  const panel = useHero((s) => s.panel);
  const pass = useHero((s) => s.pass);
  const setHero = useHero((s) => s.set);
  const entry = "solo";
  const fields = fieldsFor(entry);
  const lastKey = fields[fields.length - 1].key;
  const [values, setValues] = useState(EMPTY);
  // dropdowns switched to "Other" (their value is then whatever is typed in the text box)
  const [other, setOther] = useState({});
  const [errors, setErrors] = useState({});
  // idle | submitting | unconfigured | closed (closed in lib/event.js: say so before they type)
  const [status, setStatus] = useState(EVENT.registrationOpen ? "idle" : "closed");
  const [serverError, setServerError] = useState("");
  const honeypot = useRef(null);
  const panelRef = useRef(null);
  const firstField = useRef(null);
  const open = panel !== null;

  // ---- open / close
  const close = useCallback(() => {
    setHero({ panel: null });
    Object.assign(live.form, { open: false, caret: null, privacy: false });
  }, [setHero]);

  useEffect(() => {
    live.form.open = open;
    if (!open) return;
    const t = setTimeout(() => (panel === "form" ? firstField.current : panelRef.current)?.focus(), 450);
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        // keep keyboard focus inside the dialog
        const nodes = panelRef.current.querySelectorAll("a[href],button:not([disabled]),input,select");
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, panel, close]);

  // new content (form -> pass, or reopened) starts at the top, not where the last one was scrolled
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [panel]);

  // phones: the system back button / gesture closes the panel instead of leaving the site
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    history.pushState({ enclavePanel: true }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // closed from the UI: drop the entry we added (closed by "back": it is already gone)
      if (history.state?.enclavePanel) history.back();
    };
  }, [open]);

  // on-screen keyboard: keep the sheet above it and sized to what is still visible
  // (--kb / --vvh, read by .reg-panel in globals.css)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      root.style.setProperty("--kb", `${Math.round(kb)}px`);
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
      root.style.removeProperty("--vvh");
    };
  }, [open]);

  // swipe the sheet's header down to dismiss it (phones)
  const drag = useRef(null);
  const onHeadDown = (e) => {
    if (e.pointerType === "mouse" || e.target.closest("button") || !matchMedia("(max-width: 767px)").matches) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    panelRef.current.classList.add("is-dragging");
  };
  const onHeadMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panelRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onHeadUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = panelRef.current;
    const fast = d.dy / Math.max(1, performance.now() - d.t) > 0.5;
    el.classList.remove("is-dragging");
    el.style.transform = ""; // the CSS transition takes it from here (back up, or away)
    if (d.dy > 110 || (fast && d.dy > 30)) close();
  };

  // every "#register" link opens the panel (scrolling back to the figure first)
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.(`a[href="${EVENT.registerUrl}"], [data-register]`);
      if (!a) return;
      e.preventDefault();
      const target = useHero.getState().pass ? "pass" : "form";
      const show = () => setHero({ panel: target });
      if (!SHOW_FIGURE) show();
      else if (window.scrollY > 40 && live.lenis) live.lenis.scrollTo(0, { duration: 1.1, onComplete: show });
      else if (window.scrollY > 40) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(show, 700);
      } else show();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [setHero]);

  // ---- the figure follows the form
  const track = (el) => {
    const p = caretPoint(el);
    live.form.caret = toStageNdc(p.x, p.y);
    live.form.privacy = !!fieldByKey(el.name)?.privacy;
  };
  const onFocus = (e) => {
    track(e.target);
    // phones: once the keyboard has slid up, bring the field into view inside the sheet
    if (coarse()) {
      const el = e.target;
      setTimeout(() => document.activeElement === el && el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 320);
    }
  };
  const onBlur = () => {
    live.form.caret = null;
    live.form.privacy = false;
  };
  // the control that holds a field's value: the "Other" text box once that is picked
  const focusField = (name, openPicker = false) => {
    const root = panelRef.current;
    const el = root?.querySelector(`[data-other="${name}"]`) || root?.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.focus();
    // keyboard "Next" into a dropdown: open its list straight away where the browser allows it
    if (openPicker && el.tagName === "SELECT") {
      try {
        el.showPicker?.();
      } catch {
        /* not supported here: it's focused, a tap opens it */
      }
    }
  };

  const onKeyDown = (e) => {
    live.form.keyTick = 1;
    // the keyboard's Enter / "Next" key moves to the next field; on the last one it submits
    if (e.key === "Enter" && e.target.name !== lastKey) {
      e.preventDefault();
      const i = fields.findIndex((f) => f.key === e.target.name);
      focusField(fields[i + 1].key, true);
    }
  };

  const progressOf = (next, list) => list.filter((f) => f.check(next[f.key]) === true).length / list.length;

  const update = (key, raw) => {
    const field = fieldByKey(key);
    const value = field.upper ? raw.toUpperCase() : raw;
    const next = { ...values, [key]: value };
    setValues(next);
    if (errors[key] && field.check(value) === true) setErrors((e) => ({ ...e, [key]: undefined }));
    live.form.progress = progressOf(next, fields);
  };

  const pick = (f, value) => {
    const typing = value === OTHER;
    setOther((o) => ({ ...o, [f.key]: typing }));
    update(f.key, typing ? "" : value);
    // "Other": a text box opens under the dropdown; go straight to it
    if (typing) requestAnimationFrame(() => panelRef.current?.querySelector(`[data-other="${f.key}"]`)?.focus());
  };

  // ---- submit
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
    setServerError("");
    if (Object.keys(found).length) {
      setErrors(found);
      emit("shake");
      navigator.vibrate?.([18, 40, 18]);
      focusField(Object.keys(found)[0]);
      return;
    }

    setStatus("submitting");
    emit("scanloop");
    const started = performance.now();
    let res = null;
    let data = {};
    const person = (m) => Object.fromEntries(FIELDS.map((f) => [f.name, values[`${m}.${f.name}`]]));
    const team = entry === "team";
    try {
      res = await fetch("/enclave/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry,
          teamName: team ? values.teamName : "",
          members: team ? [person(0), person(1)] : [person(0)],
          company: honeypot.current?.value || "",
        }),
        // a stuck connection must not leave the button spinning forever
        signal: AbortSignal.timeout?.(25000),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      data = {
        ok: false,
        error:
          err?.name === "TimeoutError"
            ? "That’s taking too long. Check your internet and try again (you won’t be registered twice)."
            : "No connection. Check your internet and try again.",
      };
    }
    // let the scan finish a pass over the figure: the moment should feel deliberate
    await wait(Math.max(0, 1500 - (performance.now() - started)));
    emit("scanstop");

    if (data.ok && data.passes?.length) {
      // registered before (same RRN): their entry as it is on record (and their teammate's pass)
      const saved = { entry: data.entry === "team" ? "team" : "solo", teamName: data.teamName || "", passes: data.passes };
      savePass(saved);
      // "Register someone else" then starts from an empty form, not these details
      setValues(EMPTY);
      setOther({});
      setStatus("idle");
      setHero({ pass: { ...saved, returning: !!data.duplicate }, panel: "pass" });
      live.form.progress = 1;
      emit("nod");
      emit("ignite");
      emit("burst", { count: 240 });
      navigator.vibrate?.([30, 50, 70]);
      return;
    }
    emit("shake");
    if (res?.status === 503) setStatus("unconfigured");
    else if (res?.status === 410) setStatus("closed");
    else {
      setStatus("idle");
      if (data.field && fieldByKey(data.field)) {
        setErrors({ [data.field]: data.error });
        focusField(data.field);
      } else setServerError(data.error || "Couldn’t send that. Try again.");
    }
  };

  const googleForm = EVENT.googleFormUrl;

  return (
    <div className={`reg-root ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button type="button" className="reg-scrim" tabIndex={-1} aria-label="Close registration" onClick={close} />
      <div
        ref={panelRef}
        className="reg-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
        tabIndex={-1}
        // Lenis is stopped while the panel is open and then swallows every touch / wheel scroll
        // on the page; this opts the panel out so it scrolls natively
        data-lenis-prevent
      >
        <div
          className="reg-head flex items-center justify-between"
          onPointerDown={onHeadDown}
          onPointerMove={onHeadMove}
          onPointerUp={onHeadUp}
          onPointerCancel={onHeadUp}
        >
          <p className="mono-label text-ember">
            {panel !== "pass" ? "Registration" : pass?.passes?.length > 1 ? "Your team’s passes" : "Your access pass"}
          </p>
          <button type="button" className="reg-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {panel === "pass" && pass ? (
          <EnclavePass entry={pass} onDone={close} />
        ) : (
          <>
            <h2 id="reg-title" className="mt-4 font-display text-[clamp(2.8rem,5vw,4rem)] uppercase leading-[0.86]">
              Enter the {EVENT.name}
            </h2>
            <p className="mt-3 text-[0.9rem] leading-[1.6] text-cream/60">
              {WHEN_WHERE}. One form, one pass with a QR code for the door.
            </p>

            {status === "unconfigured" || status === "closed" ? (
              <div className="mt-8 rounded-2xl border border-ember/30 bg-ember/5 p-5">
                <p className="text-[0.95rem] text-cream">
                  {status === "closed" ? "Registrations are closed." : "The on-site form isn’t connected yet."}
                </p>
                {googleForm && status !== "closed" ? (
                  <a href={googleForm} target="_blank" rel="noreferrer" className="cta mt-4">
                    Register via Google Form
                    <span className="cta-dot" />
                  </a>
                ) : null}
              </div>
            ) : (
              <form className="reg-form" onSubmit={submit} noValidate>
                {fields.map((f, i) => {
                  const typing = !!other[f.key];
                  const err = errors[f.key];
                  const errId = `err-${f.key.replace(".", "-")}`;
                  const textProps = {
                    name: f.key,
                    value: values[f.key],
                    autoCapitalize: f.caps || "off",
                    autoCorrect: "off",
                    spellCheck: false,
                    enterKeyHint: f.key === lastKey ? "go" : "next",
                    onChange: (e) => {
                      update(f.key, e.target.value);
                      track(e.target);
                    },
                    onFocus,
                    onBlur,
                    onKeyDown,
                    onKeyUp: (e) => track(e.target),
                    onClick: (e) => track(e.target),
                    "aria-invalid": !!err,
                    "aria-describedby": err ? errId : undefined,
                  };
                  const heading = null;
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
                            onFocus={onFocus}
                            onBlur={onBlur}
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
                {/* honeypot: hidden from people, filled by bots */}
                <input ref={honeypot} name="company" tabIndex={-1} autoComplete="off" className="reg-hp" aria-hidden="true" />

                {serverError ? (
                  <p className="reg-error col-span-2" role="alert">
                    {serverError}
                  </p>
                ) : null}

                <button type="submit" className="cta col-span-2 mt-2 justify-center" data-gaze="ignite" disabled={status === "submitting"}>
                  {status === "submitting" ? "Scanning…" : "Claim my pass"}
                  <span className="cta-dot" />
                </button>
                <p className="col-span-2 text-center text-[0.78rem] leading-[1.5] text-cream/45">
                  Lost your pass, or your teammate already signed you up? Register again with your own RRN and you’ll get your pass back.
                </p>
                {googleForm ? (
                  <a href={googleForm} target="_blank" rel="noreferrer" className="col-span-2 text-center text-[0.8rem] text-cream/50 underline-offset-4 hover:text-cream hover:underline">
                    Prefer Google Form?
                  </a>
                ) : null}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
