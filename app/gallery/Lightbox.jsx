"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Shot from "./Shot";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function pad(value, total) {
  return String(value).padStart(String(total).length, "0");
}

export default function Lightbox({ photos, index, onIndex, onClose, picked, onToggle, eventTitle }) {
  const dialogRef = useRef(null);
  const currentThumbRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, id: null });

  const total = photos.length;
  const photo = photos[index];
  const isPicked = photo ? picked.has(photo.file) : false;

  const go = useCallback(
    (delta) => {
      if (!total) return;
      onIndex((index + delta + total) % total);
    },
    [index, total, onIndex],
  );

  const neighbours = useMemo(() => {
    if (total < 2) return [];
    const next = photos[(index + 1) % total];
    const previous = photos[(index - 1 + total) % total];
    return total === 2 ? [next] : [next, previous];
  }, [photos, index, total]);

  // Keyboard: escape out, arrows walk the set, Tab stays inside the dialog.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return undefined;
    node.focus({ preventScroll: true });

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = Array.from(node.querySelectorAll(FOCUSABLE));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // globals.css puts `overflow-x: clip` on html and body; stacking an overflow lock on
  // top of that blanks the page out, so pin the body in place instead and put the
  // scroll position back on close.
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      paddingRight: body.style.paddingRight,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      Object.assign(body.style, previous);
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, []);

  useEffect(() => {
    const thumb = currentThumbRef.current;
    if (!thumb) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    thumb.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [index]);

  if (!photo) return null;

  const onPointerDown = (event) => {
    pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  const onPointerUp = (event) => {
    if (pointer.current.id !== event.pointerId) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current.id = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="g-lb"
      role="dialog"
      aria-modal="true"
      aria-label={`${eventTitle} — photo viewer`}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="g-lb-bar">
        <p className="ev-label m-0 truncate">
          <span style={{ color: "var(--ev-accent)" }}>{pad(index + 1, total)}</span>
          {` / ${pad(total, total)} `}
          <span className="text-[var(--ev-dim)]">{`// ${photo.file}`}</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="ev-cta-ghost px-3"
            onClick={() => onToggle(photo.file)}
            aria-pressed={isPicked}
          >
            {isPicked ? "Marked" : "Mark"}
          </button>
          <a className="ev-cta px-3" href={photo.src} download={photo.file}>
            ↓ Save
          </a>
          <button type="button" className="ev-cta-ghost px-3" onClick={onClose} aria-label="Close viewer">
            ✕
          </button>
        </div>
      </div>

      <div className="g-lb-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {total > 1 ? (
          <button type="button" className="g-lb-nav g-lb-prev" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
        ) : null}

        <Shot key={photo.file} photo={photo} sizes="100vw" className="g-lb-shot" priority quality={88} />

        {total > 1 ? (
          <button type="button" className="g-lb-nav g-lb-next" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
        ) : null}

        {/* warms the neighbours so arrowing through is instant */}
        <div className="g-hidden-preload" aria-hidden="true">
          {neighbours.map((item) => (
            <Shot key={item.file} photo={item} sizes="100vw" quality={88} />
          ))}
        </div>
      </div>

      <div className="g-lb-foot">
        {photo.caption ? (
          <p className="m-0 px-3 pt-3 text-[1.05rem] leading-[1.5] text-[var(--ev-ink)]">{photo.caption}</p>
        ) : null}

        <div className="g-strip">
          {photos.map((item, itemIndex) => (
            <button
              key={item.file}
              type="button"
              className="g-strip-item"
              aria-current={itemIndex === index ? "true" : undefined}
              aria-label={`Photo ${itemIndex + 1} of ${total}`}
              ref={itemIndex === index ? currentThumbRef : null}
              onClick={() => onIndex(itemIndex)}
            >
              <Shot photo={item} sizes="78px" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
