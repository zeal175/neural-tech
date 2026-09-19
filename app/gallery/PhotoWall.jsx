"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Seen from "../tartarus/Seen";
import Shot from "./Shot";
import Lightbox from "./Lightbox";

const TILE_SIZES =
  "(max-width: 620px) 100vw, (max-width: 1000px) 50vw, (max-width: 1440px) 33vw, 25vw";
const STAGGER = 70;

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

/** Stable pseudo-random in 0..1 — the scatter must match between server and client. */
function jitter(index, salt) {
  const n = Math.sin((index + 1) * (12.9898 + salt)) * 43758.5453;
  return n - Math.floor(n);
}

function tileVars(index) {
  return {
    "--g-delay": `${(index % 4) * STAGGER}ms`,
    "--g-rot": `${((jitter(index, 0) - 0.5) * 7).toFixed(2)}deg`,
    "--g-dx": `${((jitter(index, 1.7) - 0.5) * 26).toFixed(1)}px`,
    "--g-dy": `${(12 + jitter(index, 3.1) * 24).toFixed(1)}px`,
  };
}

export default function PhotoWall({ event, photos, chrome = {} }) {
  const [picked, setPicked] = useState(() => new Set());
  const [openAt, setOpenAt] = useState(null);
  const tiles = useRef([]);
  const wallRef = useRef(null);
  const cursorRef = useRef(null);

  const toggle = useCallback((file) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }, []);

  const allPicked = picked.size === photos.length && photos.length > 0;

  const markAll = useCallback(() => {
    setPicked((current) =>
      current.size === photos.length ? new Set() : new Set(photos.map((photo) => photo.file)),
    );
  }, [photos]);

  const close = useCallback(() => {
    const tile = openAt == null ? null : tiles.current[openAt];
    setOpenAt(null);
    if (tile) window.requestAnimationFrame(() => tile.focus({ preventScroll: true }));
  }, [openAt]);

  const zipHref = useMemo(() => {
    if (!picked.size) return null;
    const params = new URLSearchParams({ event: event.slug });
    photos.forEach((photo) => {
      if (picked.has(photo.file)) params.append("file", photo.file);
    });
    return `/api/gallery/zip?${params.toString()}`;
  }, [picked, photos, event.slug]);

  // A label that trails the pointer across the wall. Fine pointers only, and never
  // when the viewer has asked for less motion.
  useEffect(() => {
    const wall = wallRef.current;
    const label = cursorRef.current;
    if (!wall || !label) return undefined;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame = 0;
    let x = 0;
    let y = 0;

    const render = () => {
      frame = 0;
      label.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
    };

    const onMove = (pointerEvent) => {
      x = pointerEvent.clientX;
      y = pointerEvent.clientY;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onEnter = () => label.classList.add("is-on");
    const onLeave = () => label.classList.remove("is-on");

    wall.addEventListener("pointermove", onMove);
    wall.addEventListener("pointerenter", onEnter);
    wall.addEventListener("pointerleave", onLeave);

    return () => {
      wall.removeEventListener("pointermove", onMove);
      wall.removeEventListener("pointerenter", onEnter);
      wall.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // The pointer doesn't move when the viewer opens, so drop the label by hand.
  useEffect(() => {
    if (openAt != null) cursorRef.current?.classList.remove("is-on");
  }, [openAt]);

  // Scatter → settle, scrubbed against scroll position. Each tile's progress is how far
  // it has risen up the viewport, so scrolling back down scatters the prints again.
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame = 0;

    const update = () => {
      frame = 0;
      const view = window.innerHeight;
      wall.querySelectorAll(".g-tile").forEach((tile) => {
        const box = tile.getBoundingClientRect();
        let progress = 1;
        if (box.top > view) progress = 0;
        else if (box.bottom > -200) {
          progress = Math.min(1, Math.max(0, (view - box.top) / (view * 0.55)));
        }
        tile.style.setProperty("--g-p", progress.toFixed(3));
      });
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [photos.length]);

  return (
    <div style={{ paddingBottom: picked.size ? "7.5rem" : undefined }}>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--ev-line)] px-1 py-3">
        <p className="ev-label m-0">
          <span style={{ color: "var(--ev-accent)" }}>{pad(photos.length)}</span> files recovered
        </p>
        <div className="flex items-center gap-3">
          <span className="ev-label">
            {picked.size ? `${pad(picked.size)} marked` : "hover a frame — mark what you want"}
          </span>
          <button type="button" className="ev-cta-ghost px-3" onClick={markAll}>
            {allPicked ? "Unmark all" : "Mark all"}
          </button>
        </div>
      </div>

      <div className="g-wall mt-3" ref={wallRef}>
        {photos.map((photo, index) => {
          const isPicked = picked.has(photo.file);
          return (
            <Seen
              key={photo.file}
              className={`g-tile${isPicked ? " is-picked" : ""}`}
              style={tileVars(index)}
            >
              <button
                type="button"
                ref={(node) => {
                  tiles.current[index] = node;
                }}
                className={`g-frame${photo.width ? "" : " g-frame-box"}`}
                onClick={() => setOpenAt(index)}
                aria-label={`Open photo ${index + 1} of ${photos.length}: ${photo.alt}`}
              >
                <Shot photo={photo} sizes={TILE_SIZES} priority={index < 2} />
                {chrome.sweep ? <span className="g-sweep" aria-hidden="true" /> : null}
                <span className="g-index">{`#${pad(index + 1, 3)}`}</span>
                <span className="g-cap">
                  {photo.caption ? (
                    <span className="block text-[0.95rem] leading-[1.35]">{photo.caption}</span>
                  ) : null}
                  <span className="ev-label block text-[0.78rem]">
                    {photo.width ? `${photo.width}×${photo.height}` : photo.file}
                  </span>
                </span>
              </button>

              <span className="g-actions">
                <button
                  type="button"
                  className="g-act"
                  aria-pressed={isPicked}
                  aria-label={`${isPicked ? "Unmark" : "Mark"} photo ${index + 1}`}
                  onClick={() => toggle(photo.file)}
                >
                  {isPicked ? "✓" : "▢"}
                </button>
                <a
                  className="g-act"
                  href={photo.src}
                  download={photo.file}
                  aria-label={`Download photo ${index + 1}`}
                >
                  ↓
                </a>
              </span>
            </Seen>
          );
        })}
      </div>

      <span className="g-cursor" ref={cursorRef} aria-hidden="true">
        View ↗
      </span>

      {picked.size ? (
        <div className="g-tray">
          <p className="ev-label m-0">
            <span style={{ color: "var(--ev-accent)" }}>{pad(picked.size)}</span>
            {` file${picked.size === 1 ? "" : "s"} marked`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="ev-cta-ghost px-3" onClick={() => setPicked(new Set())}>
              Clear
            </button>
            <a className="ev-cta px-3" href={zipHref} download>
              ↓ Download .zip
            </a>
          </div>
        </div>
      ) : null}

      {openAt != null ? (
        <Lightbox
          photos={photos}
          index={openAt}
          onIndex={setOpenAt}
          onClose={close}
          picked={picked}
          onToggle={toggle}
          eventTitle={event.title}
        />
      ) : null}
    </div>
  );
}
