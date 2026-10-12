"use client";

import { useEffect, useState } from "react";
import { EVENT } from "@/lib/event";

const pad = (n) => String(n).padStart(2, "0");

/** Live countdown to the event ("Date to be announced" while the date is open). */
export default function Countdown({ className = "" }) {
  const [now, setNow] = useState(null); // null on the server: avoids a hydration mismatch

  useEffect(() => {
    if (!EVENT.startsAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!EVENT.startsAt) return <span className={`mono-label text-ember/55 ${className}`}>{EVENT.dateLong}</span>;
  if (now === null) return <span className={className}>&nbsp;</span>;
  const diff = Date.parse(EVENT.startsAt) - now;
  if (diff <= 0) {
    return (
      <span className={`mono-label text-ember ${className}`}>
        {diff > -12 * 3600e3 ? "Live now" : "That’s a wrap · thank you"}
      </span>
    );
  }
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const units = [
    [pad(d), "Days"],
    [pad(Math.floor((s % 86400) / 3600)), "Hrs"],
    [pad(Math.floor((s % 3600) / 60)), "Mins"],
    [pad(s % 60), "Secs"],
  ];
  return (
    <span className={`e-clock countdown-num ${className}`} data-gaze aria-label={`${d} days to go`}>
      {units.map(([value, label]) => (
        <span key={label}>
          <b>{value}</b>
          <i>{label}</i>
        </span>
      ))}
    </span>
  );
}
