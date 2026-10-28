"use client";

/**
 * ENCLAVE spiral gallery at /gallery/enclave. The page scroll is the source of truth: a tall
 * section with a sticky stage, every STEP pixels of scroll is one card. Wheel, touch, keys and
 * the scrollbar all just scroll; dragging the stage scrolls too. Clicking a card opens the
 * shared Enclave lightbox, and closing it leaves the spiral on the last photo viewed.
 */
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnclaveLightbox, { prefetchSharp } from "../EnclaveLightbox";
import "./helix.css";

const HelixCanvas = dynamic(() => import("./HelixCanvas"), { ssr: false });

const STEP = 88;
const STEP_PHONE = 40;

function pad(value, width = 3) {
  return String(value).padStart(width, "0");
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** If WebGL dies or the scene throws, the page falls back to the grid. */
class CanvasGuard extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HelixGallery({ event, dateLabel = "", photos = [], onFail }) {
  const items = useMemo(
    () =>
      photos.map((photo, index) => ({
        id: photo.file || `photo-${index + 1}`,
        index,
        file: photo.file || "",
        src: photo.src,
        alt: photo.alt || photo.caption || `ENCLAVE photo ${index + 1}`,
        width: photo.width || 1200,
        height: photo.height || 900,
      })),
    [photos],
  );
  const n = items.length;

  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const railRef = useRef(null);
  const cursorRef = useRef(null);
  const stepRef = useRef(STEP);
  const drag = useRef({
    down: false,
    moved: false,
    touch: false,
    skipClick: false,
    x: 0,
    y: 0,
    x0: 0,
    y0: 0,
    t: 0,
    t0: 0,
    v: 0,
    rail: false,
  });
  const inertia = useRef(0);
  const lastOpen = useRef(0);
  const openedAt = useRef(0);
  const live = useRef(null);
  if (!live.current) {
    live.current = {
      target: 0,
      shown: 0,
      vel: 0,
      pointer: { x: 0, y: 0, inside: false, dragging: false },
      invalidate: null,
      pick: null,
      pointerMoved: null,
    };
  }

  const [step, setStep] = useState(STEP);
  const [focus, setFocus] = useState(0);
  const [hover, setHover] = useState(-1);
  const [open, setOpen] = useState(null);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [tick, setTick] = useState(0);

  // phones get a shorter scroll per card
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => {
      stepRef.current = mq.matches ? STEP_PHONE : STEP;
      setStep(stepRef.current);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const sectionTop = () => (sectionRef.current?.getBoundingClientRect().top || 0) + window.scrollY;

  // html has scroll-behavior: smooth, so every programmatic scroll names its behaviour: drags and
  // jumps are "instant" (a smooth scroll per pointer move would lag and fight the next one)
  const scrollToIndex = useCallback(
    (index, behavior = "smooth") => {
      const i = clamp(Math.round(index), 0, Math.max(0, n - 1));
      window.scrollTo({ top: sectionTop() + i * stepRef.current, behavior });
    },
    [n],
  );

  // page scroll → focus
  const sync = useCallback(() => {
    const el = sectionRef.current;
    if (!el || !n) return 0;
    const raw = -el.getBoundingClientRect().top / stepRef.current;
    const f = clamp(raw, 0, n - 1);
    live.current.target = f;
    live.current.invalidate?.();
    railRef.current?.style.setProperty("--hx-p", n > 1 ? (f / (n - 1)).toFixed(4) : "0");
    return raw;
  }, [n]);

  useEffect(() => {
    let timer = 0;
    // settle on the nearest card once the scroll stops (not mid-drag, not outside the pin)
    const snap = () => {
      if (drag.current.down || inertia.current) return;
      const raw = sync();
      if (raw <= 0.02 || raw >= n - 1.02) return;
      if (Math.abs(raw - Math.round(raw)) > 0.02) scrollToIndex(raw);
    };
    const onScroll = () => {
      const raw = sync();
      if (raw > 0.3) setTouched(true);
      window.clearTimeout(timer);
      // phones snap sooner so the spiral doesn't feel slack after a flick
      timer = window.setTimeout(snap, stepRef.current <= STEP_PHONE ? 90 : 170);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      window.clearTimeout(timer);
    };
  }, [n, step, sync, scrollToIndex]);

  // screen readers hear where they are once the spiral comes to rest
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounce(`Photo ${focus + 1} of ${n}`), 450);
    setTick((t) => t + 1);
    return () => window.clearTimeout(timer);
  }, [focus, n]);

  // closing the lightbox leaves the spiral on the last photo viewed
  useEffect(() => {
    if (open != null) {
      lastOpen.current = open;
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (lastOpen.current !== Math.round(live.current.target)) scrollToIndex(lastOpen.current, "instant");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, scrollToIndex]);

  const openAt = useCallback(
    (index) => {
      if (index < 0 || index >= n) return;
      openedAt.current = performance.now();
      prefetchSharp(items[index].src);
      setOpen(index);
    },
    [items, n],
  );

  /** Focused card — reliable on phones where WebGL raycasts / pointercancel miss taps. */
  const openFocused = useCallback(() => {
    openAt(Math.round(live.current.target));
  }, [openAt]);

  // the scroll-end snap waits while a finger or a flick is still moving the page; nudge it after
  const settleSoon = () => window.dispatchEvent(new Event("scroll"));

  const stopInertia = () => {
    if (inertia.current) window.cancelAnimationFrame(inertia.current);
    inertia.current = 0;
  };

  const setPointer = (e) => {
    const box = stageRef.current.getBoundingClientRect();
    const p = live.current.pointer;
    p.x = ((e.clientX - box.left) / box.width) * 2 - 1;
    p.y = -(((e.clientY - box.top) / box.height) * 2 - 1);
    p.inside = true;
    live.current.pointerMoved?.();
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 18}px, 0)`;
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    stopInertia();
    setPointer(e);
    const d = drag.current;
    d.down = true;
    d.moved = false;
    d.skipClick = false;
    // touch/pen: leave vertical scroll to the browser — capturing it here made mobile feel loose
    d.touch = e.pointerType !== "mouse";
    d.x = d.x0 = e.clientX;
    d.y = d.y0 = e.clientY;
    d.t = d.t0 = performance.now();
    d.v = 0;
  };

  const onPointerMove = (e) => {
    setPointer(e);
    const d = drag.current;
    if (!d.down) return;
    if (d.touch) {
      // fingers jitter more than a mouse; keep taps from counting as a scroll
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 28) {
        d.moved = true;
        d.skipClick = true;
      }
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) {
      d.moved = true;
      d.skipClick = true;
      live.current.pointer.dragging = true;
      setDragging(true);
      setTouched(true);
      stageRef.current.setPointerCapture?.(e.pointerId);
    }
    if (!d.moved) return;
    // a horizontal drag of about one card is one step; a vertical mouse drag pulls the page
    const cardPx = stageRef.current.clientHeight * 0.4;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const amount = -dx * (stepRef.current / cardPx) - dy;
    window.scrollBy({ top: amount, behavior: "instant" });
    const now = performance.now();
    d.v = amount / Math.max(1, now - d.t);
    d.t = now;
    d.x = e.clientX;
    d.y = e.clientY;
  };

  const endDrag = (e, cancelled) => {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    live.current.pointer.dragging = false;
    setDragging(false);
    // a finger is not a cursor: no hover or parallax once it lifts
    const lift = () => {
      if (e.pointerType === "mouse") return;
      live.current.pointer.inside = false;
      live.current.pointerMoved?.();
    };

    // Phones: iOS often pointercancel's taps. Don't open here — the click / hit-target path does.
    // Desktop: open on a clean press via raycast (or focused card if the hit misses).
    if (!d.moved && !cancelled && !d.touch) {
      setPointer(e);
      const hit = live.current.pick?.() ?? -1;
      openAt(hit >= 0 ? hit : Math.round(live.current.target));
      d.skipClick = true;
      lift();
      return;
    }

    lift();
    if (d.touch) {
      if (d.moved) settleSoon();
      return;
    }
    if (!d.moved) return;
    // let a flick carry on, then the scroll-end snap settles it
    let v = d.v;
    let last = performance.now();
    const coast = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      v *= Math.pow(0.93, dt / 16);
      if (Math.abs(v) < 0.02) {
        inertia.current = 0;
        settleSoon();
        return;
      }
      window.scrollBy({ top: v * dt, behavior: "instant" });
      inertia.current = window.requestAnimationFrame(coast);
    };
    if (Math.abs(v) > 0.05) inertia.current = window.requestAnimationFrame(coast);
    else settleSoon();
  };

  // click survives iOS pointercancel; skip after a drag or a desktop pointer-open
  const onStageClick = (e) => {
    if (e.target.closest(".hx-rail")) return;
    if (drag.current.skipClick || drag.current.moved) return;
    if (performance.now() - openedAt.current < 400) return;
    setTouched(true);
    openFocused();
  };

  const onPointerLeave = () => {
    if (drag.current.down) return;
    live.current.pointer.inside = false;
    live.current.pointerMoved?.();
  };

  const onKeyDown = (e) => {
    const at = Math.round(live.current.target);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setTouched(true);
      scrollToIndex(at + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setTouched(true);
      scrollToIndex(at - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt(at);
    }
  };

  // the rail is a scrubber: drag it to jump anywhere in the set
  const scrub = (e) => {
    const box = railRef.current.getBoundingClientRect();
    const k = clamp((e.clientY - box.top) / box.height, 0, 1);
    window.scrollTo({ top: sectionTop() + k * (n - 1) * stepRef.current, behavior: "instant" });
  };
  const onRailDown = (e) => {
    e.stopPropagation();
    stopInertia();
    drag.current.rail = true;
    railRef.current.setPointerCapture?.(e.pointerId);
    setTouched(true);
    scrub(e);
  };
  const onRailMove = (e) => {
    e.stopPropagation();
    if (drag.current.rail) scrub(e);
  };
  const onRailUp = (e) => {
    e.stopPropagation();
    drag.current.rail = false;
    settleSoon();
  };

  const current = items[focus];

  return (
    <section
      ref={sectionRef}
      className={`hx${ready ? " is-ready" : ""}`}
      style={{ height: `calc(100svh + ${Math.max(0, n - 1) * step}px)` }}
      aria-label={`${event.title} gallery`}
    >
      <div
        ref={stageRef}
        className={`hx-stage${dragging ? " is-dragging" : ""}`}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${event.title} photos. Scroll or use the arrow keys to move, Enter to open.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onPointerLeave={onPointerLeave}
        onClick={onStageClick}
        onKeyDown={onKeyDown}
        {...(open != null ? { inert: true } : {})}
      >
        <CanvasGuard onFail={onFail}>
          <HelixCanvas
            photos={items}
            live={live.current}
            onFocus={setFocus}
            onHover={setHover}
            onReady={() => setReady(true)}
            onFail={onFail}
          />
        </CanvasGuard>

        {/* Phones: dedicated tap target over the focused card. Survives WebGL/pointercancel quirks. */}
        <button
          type="button"
          className="hx-open-hit"
          aria-label={`Open photo ${focus + 1} of ${n}`}
          onClick={(e) => {
            e.stopPropagation();
            if (drag.current.skipClick || drag.current.moved) return;
            setTouched(true);
            openFocused();
          }}
        />

        <div className="hx-veil" aria-hidden="true" />
        <div className="hx-grain" aria-hidden="true" />

        <div className="hx-hud" aria-hidden="true">
          <p className="hx-kicker">
            {event.title} · archive
            {dateLabel ? <span>{dateLabel}</span> : null}
          </p>

          <div className="hx-count">
            <p className="hx-count-line">
              <span key={tick} className="hx-count-n">
                {pad(focus + 1)}
              </span>
              <span className="hx-count-of">/ {pad(n)}</span>
            </p>
            {current?.file ? (
              <p className="hx-file">
                {current.file} · {current.width}×{current.height}
              </p>
            ) : null}
          </div>

          <p className={`hx-hint${touched ? " is-gone" : ""}`}>
            <span className="hx-hint-wide">Scroll · drag · click to open</span>
            <span className="hx-hint-narrow">Scroll · tap to open</span>
          </p>

          <p className="hx-loader">
            Recovering files<i>_</i>
          </p>
        </div>

        <div
          ref={railRef}
          className="hx-rail"
          onPointerDown={onRailDown}
          onPointerMove={onRailMove}
          onPointerUp={onRailUp}
          onPointerCancel={onRailUp}
          aria-hidden="true"
        >
          <span className="hx-rail-fill" />
          <span className="hx-rail-thumb" />
          <span className="hx-rail-end hx-rail-top">{pad(1)}</span>
          <span className="hx-rail-end hx-rail-bottom">{pad(n)}</span>
        </div>

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>

      <ol className="sr-only">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" tabIndex={-1} onClick={() => openAt(item.index)}>
              Open photo {item.index + 1} of {n}: {item.alt}
            </button>
          </li>
        ))}
      </ol>

      <span className={`hx-cursor${hover >= 0 && !dragging ? " is-on" : ""}`} ref={cursorRef} aria-hidden="true">
        Open ↗
      </span>

      <EnclaveLightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </section>
  );
}
