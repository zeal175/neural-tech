"use client";

import { useState } from "react";
import LineReveal from "./LineReveal";

const years = ["1st year", "2nd year", "3rd year", "4th year"];

const field =
  "w-full rounded-xl border-0 bg-cream px-4 py-3 text-[0.92rem] text-soil outline-none placeholder:text-soil/40 focus:ring-2 focus:ring-soil/20";
const label = "mb-1.5 block text-[0.68rem] font-normal uppercase tracking-[0.12em] text-soil/55";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-cream/80 px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-cream hover:text-soil active:scale-[0.98]";
const btnDark =
  "inline-flex items-center justify-center rounded-full bg-soil px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-navy active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
const display =
  "font-display text-[clamp(2.15rem,5.15vw,4.625rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";

const empty = {
  name: "",
  rrn: "",
  dept: "",
  section: "",
  year: "",
  phone: "",
  ntc: "",
  company: "",
};

export default function ClubRegister() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("sending");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "That didn’t send. Try again.");
      }
      setStatus("sent");
      setForm(empty);
    } catch (err) {
      setStatus("idle");
      setError(err.message || "That didn’t send. Try again.");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
        <p className="mb-5 text-[0.68rem] font-normal uppercase tracking-[0.14em] text-cream/55">
          <span className="mr-2 text-blush">●</span>Registration received
        </p>
        <LineReveal
          as="p"
          className={`${display} text-cream`}
          lines={["You’re in.", "Don’t vanish."]}
        />
        <p className="mx-auto mt-6 max-w-[34ch] text-[0.95rem] leading-[1.65] text-cream/75">
          We’ll ping you when the next session, build night, or strange experiment is happening.
        </p>
        <div className="mt-8 flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
          <a className={btnFill} href="/">
            Back home
          </a>
          <a className={btnGhost} href="/tartarus">
            See Tartarus
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <LineReveal as="h1" className={`${display} text-center text-cream`} lines={["Join the club."]} />
      <p className="mx-auto mt-5 mb-10 max-w-[38ch] text-center text-[0.95rem] leading-[1.65] text-cream/75">
        Fill this in. We’ll take it from there.
      </p>
      <form
        onSubmit={onSubmit}
        className="relative mx-auto max-w-[640px] rounded-2xl bg-white p-5 text-left text-soil shadow-[0_8px_28px_rgba(65,51,51,0.08)] sm:p-7"
        noValidate
      >
        <p className="mb-5 text-[0.68rem] font-normal uppercase tracking-[0.12em] text-soil/50">Club registration</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Name</span>
            <input className={field} name="name" autoComplete="name" value={form.name} onChange={update("name")} required />
          </label>
          <label className="block">
            <span className={label}>RRN</span>
            <input className={field} name="rrn" autoComplete="off" value={form.rrn} onChange={update("rrn")} required />
          </label>
          <label className="block">
            <span className={label}>Dept</span>
            <input className={field} name="dept" value={form.dept} onChange={update("dept")} required />
          </label>
          <label className="block">
            <span className={label}>Section</span>
            <input className={field} name="section" value={form.section} onChange={update("section")} required />
          </label>
          <label className="block">
            <span className={label}>Year</span>
            <select className={`${field} appearance-none`} name="year" value={form.year} onChange={update("year")} required>
              <option value="" disabled>
                Pick one
              </option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Phone No.</span>
            <input
              className={field}
              type="tel"
              name="phone"
              autoComplete="tel"
              value={form.phone}
              onChange={update("phone")}
              required
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={label}>What do you want to do in NTC</span>
          <textarea
            className={`${field} min-h-[88px] resize-none`}
            name="ntc"
            value={form.ntc}
            onChange={update("ntc")}
            required
          />
        </label>

        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <input tabIndex={-1} autoComplete="off" name="company" value={form.company} onChange={update("company")} />
        </div>

        {error ? <p className="mt-4 text-[0.84rem] leading-[1.5] text-blush">{error}</p> : null}

        <button className={`${btnDark} mt-5 w-full sm:w-auto`} type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Join the club"}
        </button>
      </form>
    </>
  );
}
