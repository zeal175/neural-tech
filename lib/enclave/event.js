// Single source of truth for event copy and registration settings.

// ─── EDIT HERE ───────────────────────────────────────────────────────────────────────────────
// Change these, push, and the site (hero, passes, link previews, check-in) follows.
const SETTINGS = {
  // event day as "YYYY-MM-DD", e.g. "2026-10-16". Leave "" while it isn't decided: the site
  // then says SOON / "Date to be announced" and hides the countdown.
  eventDate: "2026-10-22",
  // start time, 24-hour, India time (the countdown counts down to it)
  startTime: "09:00",
  // e.g. "Main Auditorium". Leave "" while it isn't decided ("Venue to be announced").
  venue: "Web Technology Lab",
  // optional Google Form, shown as "Prefer Google Form?" under the on-site form and as the
  // fallback if the on-site form is down, e.g. "https://forms.gle/...". "" hides it.
  googleFormUrl: "",
  // false closes registrations (the form then says so)
  registrationOpen: true,
  // UPI: drop your QR image at public/enclave/upi-qr.png (or set NEXT_PUBLIC_UPI_QR).
  // Optional VPA / amount for the copy under the code.
  upiQr: "/enclave/upi-qr.png",
  upiVpa: "",
  upiName: "Neural Techgenix Club",
  upiAmount: "50",
  // WhatsApp group invite (chat.whatsapp.com/…). "" hides the join button.
  // Or set NEXT_PUBLIC_ENCLAVE_WHATSAPP.
  whatsappGroupUrl: "https://chat.whatsapp.com/CaaAHySV6UJ25v6zkdA7by",
  // the Department and Section dropdowns on the form, in this order. Each list also gets an
  // "Other" choice that lets people type their own.
  departments: ["CSE", "IT", "AI & DS", "CSE (AI & ML)", "CSE (Cyber Security)", "ECE", "EEE", "EIE", "MECH", "CIVIL", "AUTO", "AERO", "BIOTECH"],
  sections: ["A", "B", "C", "D", "E", "F", "G", "H"],
};
// ─────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(SETTINGS.eventDate.trim());
const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(SETTINGS.startTime.trim()) || [null, "9", "00"];
const dateSet = !!dateMatch;
const venueSet = SETTINGS.venue.trim().length > 0;
const hour = Number(timeMatch[1]);

export const EVENT = {
  name: "ENCLAVE",
  department: "Department of CSE",
  institution: "Crescent Institute",
  club: "Neural Techgenix Club",
  // Shown in the facts band. People register one-by-one; pairing happens on event day.
  format: "Solo or duo",
  formatNote: "Register individually — teams are formed on the day.",
  seats: "60 only",
  fee: "₹50",
  prize: "₹2,000",
  experience: "None",
  registerUrl: "/enclave/register",
  registrationOpen: SETTINGS.registrationOpen,
  googleFormUrl: SETTINGS.googleFormUrl.trim(),
  upiQr: (process.env.NEXT_PUBLIC_UPI_QR || SETTINGS.upiQr || "/enclave/upi-qr.png").trim(),
  upiVpa: (process.env.NEXT_PUBLIC_UPI_VPA || SETTINGS.upiVpa || "").trim(),
  upiName: (process.env.NEXT_PUBLIC_UPI_NAME || SETTINGS.upiName || "").trim(),
  upiAmount: (process.env.NEXT_PUBLIC_UPI_AMOUNT || SETTINGS.upiAmount || "50").trim(),
  whatsappGroupUrl: (process.env.NEXT_PUBLIC_ENCLAVE_WHATSAPP || SETTINGS.whatsappGroupUrl || "").trim(),

  dateSet,
  venueSet,
  // big display date: "16.10.26", or SOON while undecided
  date: dateSet ? `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1].slice(2)}` : "SOON",
  // "16 October 2026", or "Date to be announced"
  dateLong: dateSet ? `${Number(dateMatch[3])} ${MONTHS[Number(dateMatch[2]) - 1]} ${dateMatch[1]}` : "Date to be announced",
  // "9:00 AM"
  timeLabel: `${hour % 12 || 12}:${timeMatch[2]} ${hour < 12 ? "AM" : "PM"}`,
  // countdown target (India time), or null while the date is open
  startsAt: dateSet ? `${dateMatch[0]}T${String(hour).padStart(2, "0")}:${timeMatch[2]}:00+05:30` : null,
  venue: SETTINGS.venue.trim(),
  // "Main Auditorium", or "Venue to be announced"
  venueLabel: venueSet ? SETTINGS.venue.trim() : "Venue to be announced",
};

/** "16 October 2026 · Main Auditorium" with whatever is known (the institution if no venue yet). */
export const WHEN_WHERE = `${EVENT.dateLong} · ${EVENT.venueSet ? EVENT.venue : EVENT.institution}`;

export const YEARS = ["1st year", "2nd year", "3rd year", "4th year"];
export const DEPARTMENTS = SETTINGS.departments;
export const SECTIONS = SETTINGS.sections;
