"use client";

import { useEffect, useState } from "react";

/** Reads as a machine coming up. Skipped entirely when motion is unwelcome. */
export default function BootLine({ label, ready }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    setOnline(false);
    const id = window.setTimeout(() => setOnline(true), 1100);
    return () => window.clearTimeout(id);
  }, []);

  return <span>{online ? ready : label}</span>;
}
