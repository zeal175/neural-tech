"use client";

// ENC-01 on the Enclave bar of /gallery: hover the row and the rover drifts in from the right like a
// car in Cars, parks in the bar's empty middle and idles; leave and it pivots and blasts off. On touch
// screens it drifts in once, when the bar scrolls into view, and stays parked. With reduced motion it
// just fades in, parked.
//
// This part is the DOM side: the triggers, and loading the 3D scene (RoverCanvas) on idle, or as soon
// as the pointer is over the list, so the first hover doesn't wait. Until it's ready the row's own CSS
// hover plays as before.
//
// Dev only: ?rover=loop replays entry and exit; ?rover=t:1.2 freezes the entry at 1.2 s.
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState } from "react";

const RoverCanvas = dynamic(() => import("./RoverCanvas"), { ssr: false });
const DEV = process.env.NODE_ENV !== "production";

/** a model or chunk that fails to load costs the row its rover, not the page */
class Quiet extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    if (DEV) console.warn("[rover]", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function RoverDrift() {
  const host = useRef(null);
  const [armed, setArmed] = useState(false);
  const director = useRef(null);
  director.current ??= {
    want: "out", // "in" while hovered / focused (or scrolled into view on touch)
    pointerX: null, // px across the row, for the head to follow
    row: null,
    reduced: false,
    touch: false,
    visible: true,
    freeze: null,
    loop: false,
    wake: () => {},
    onReady: null,
  };

  useEffect(() => {
    const d = director.current;
    const el = host.current;
    const row = el?.closest("a");
    if (!row || !webgl()) return;
    d.row = row;
    const reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
    const touchQ = matchMedia("(hover: none)");
    const sync = () => {
      d.reduced = reducedQ.matches;
      d.touch = touchQ.matches;
      d.wake();
    };
    sync();
    reducedQ.addEventListener("change", sync);
    touchQ.addEventListener("change", sync);
    d.onReady = () => {
      el.dataset.ready = "";
    };

    let armedNow = false;
    const arm = () => {
      if (armedNow) return;
      armedNow = true;
      setArmed(true);
    };
    const set = (want) => {
      d.want = want;
      if (want === "in") arm();
      d.wake();
    };

    if (DEV) {
      const q = new URLSearchParams(location.search).get("rover");
      if (q === "loop") d.loop = true;
      else if (q?.startsWith("t:")) d.freeze = Math.max(0, parseFloat(q.slice(2)) || 0);
      if (d.loop || d.freeze != null) {
        row.dataset.rover = "on";
        set("in");
      }
    }

    // load the scene when the page is idle, or as soon as the pointer is over the list
    const idle = window.requestIdleCallback ? requestIdleCallback(arm, { timeout: 3000 }) : setTimeout(arm, 1500);
    const list = row.parentElement;
    list?.addEventListener("pointerover", arm, { once: true });

    // mouse and pen: hover; keyboard: focus. Touch taps are left to the link.
    const enter = (e) => e.pointerType !== "touch" && set("in");
    const leave = (e) => {
      if (e.pointerType === "touch") return;
      d.pointerX = null;
      if (!row.matches(":focus-visible")) set("out");
    };
    const move = (e) => {
      if (e.pointerType === "touch") return;
      d.pointerX = e.clientX - row.getBoundingClientRect().left;
      d.wake();
    };
    const focus = () => row.matches(":focus-visible") && set("in");
    const blur = () => !row.matches(":hover") && set("out");
    row.addEventListener("pointerenter", enter);
    row.addEventListener("pointerleave", leave);
    row.addEventListener("pointermove", move);
    row.addEventListener("focus", focus);
    row.addEventListener("blur", blur);

    // touch: drift in once when the bar is well into view, then stay parked (the row keeps the
    // Enclave look, as a hover would give it)
    let once = null;
    if (touchQ.matches && d.freeze == null && !d.loop) {
      once = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          once.disconnect();
          row.dataset.rover = "on";
          set("in");
        },
        { threshold: 0.6 }
      );
      once.observe(row);
    }
    // no drawing while the bar is off screen
    const seen = new IntersectionObserver((entries) => {
      d.visible = entries[entries.length - 1].isIntersecting;
      d.wake();
    });
    seen.observe(row);

    return () => {
      window.cancelIdleCallback ? cancelIdleCallback(idle) : clearTimeout(idle);
      list?.removeEventListener("pointerover", arm);
      row.removeEventListener("pointerenter", enter);
      row.removeEventListener("pointerleave", leave);
      row.removeEventListener("pointermove", move);
      row.removeEventListener("focus", focus);
      row.removeEventListener("blur", blur);
      reducedQ.removeEventListener("change", sync);
      touchQ.removeEventListener("change", sync);
      once?.disconnect();
      seen.disconnect();
    };
  }, []);

  return (
    <span ref={host} className="ar-rover" aria-hidden="true">
      {armed ? (
        <Quiet>
          <RoverCanvas director={director.current} />
        </Quiet>
      ) : null}
    </span>
  );
}
