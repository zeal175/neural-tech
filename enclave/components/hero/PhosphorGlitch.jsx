"use client";

import { useEffect } from "react";

const FRAME = 1000 / 24;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setVars(el, next) {
  el.style.setProperty("--ph-x", `${next.x}px`);
  el.style.setProperty("--ph-y", `${next.y}px`);
  el.style.setProperty("--ph-skew", `${next.skew}deg`);
  el.style.setProperty("--ph-op", String(next.op));
  el.style.setProperty("--ph-split", `${next.split}px`);
  el.style.setProperty("--ph-ghost", String(next.ghost));
}

const CLEAN = { x: 0, y: 0, skew: 0, op: 1, split: 0, ghost: 0 };

/** 24fps stepped phosphor noise on the ENCLAVE word. Does not touch GSAP letter targets. */
export default function usePhosphorGlitch(ref, { on, reduced } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduced || !on) {
      setVars(el, CLEAN);
      return undefined;
    }

    const rand = mulberry(0x656e63 ^ Math.floor(performance.now()));
    let mode = "lock";
    let lockI = 0;
    let burst = 0;
    let hold = 0;
    let last = 0;
    let raf = 0;

    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < FRAME) return;
      last = t;

      if (mode === "lock") {
        const p = 1 - lockI / 12;
        setVars(el, {
          x: (rand() - 0.5) * 12 * p,
          y: (rand() - 0.5) * 4 * p,
          skew: (rand() > 0.5 ? 1 : -1) * (3 + rand() * 5) * p,
          op: 0.45 + (1 - p) * 0.55,
          split: 4 + 10 * p,
          ghost: 0.75 * p,
        });
        lockI += 1;
        if (lockI >= 12) {
          mode = "hold";
          setVars(el, CLEAN);
          hold = 36 + Math.floor(rand() * 72);
        }
        return;
      }

      if (burst > 0) {
        setVars(el, {
          x: (rand() - 0.5) * 10,
          y: (rand() - 0.5) * 5,
          skew: (rand() > 0.55 ? 1 : -1) * (3 + rand() * 5),
          op: 0.3 + rand() * 0.5,
          split: 3 + rand() * 9,
          ghost: 0.45 + rand() * 0.5,
        });
        burst -= 1;
        if (burst <= 0) {
          setVars(el, CLEAN);
          hold = 20 + Math.floor(rand() * 90);
        }
        return;
      }

      hold -= 1;
      if (hold <= 0) {
        burst = 2 + Math.floor(rand() * 6);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setVars(el, CLEAN);
    };
  }, [ref, on, reduced]);
}
