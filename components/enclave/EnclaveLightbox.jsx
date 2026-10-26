"use client";

/**
 * Enclave expand view — a fixed popover over a frozen page, so closing restores the exact
 * scroll position. Shared by the photo grid and the 3D spiral gallery.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import "./enclave-gallery.css";

export const THUMB_QUALITY = 55;
const SHARP_SIZES = "100vw";
const SHARP_QUALITY = 88;
const FRAME_QUALITY = 75;
const STRIP_WINDOW = 12;

const warmed = new Set();

export function imageOptimizerUrl(src, width, quality) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function prefetchSharp(src) {
  if (warmed.has(src) || typeof window === "undefined") return;
  warmed.add(src);
  const img = new window.Image();
  img.decoding = "async";
  img.src = imageOptimizerUrl(src, 1920, SHARP_QUALITY);
}

function fileNameFromSrc(src) {
  try {
    return decodeURIComponent((src.split("?")[0] || src).split("/").pop() || "") || "photo.jpg";
  } catch {
    return "photo.jpg";
  }
}

/** Always fetch the public original path — never /_next/image. */
async function downloadOriginal(src) {
  const name = fileNameFromSrc(src);
  const absolute =
    typeof window !== "undefined" && src.startsWith("/")
      ? `${window.location.origin}${src}`
      : src;
  try {
    const response = await fetch(absolute, { cache: "force-cache", credentials: "same-origin" });
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    const link = document.createElement("a");
    link.href = absolute;
    link.download = name;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function ExpandPhoto({ image }) {
  const [sharpReady, setSharpReady] = useState(false);
  const w = image.width || 1600;
  const h = image.height || 1200;

  return (
    <div className="en-gal-expand-hero">
      <Image
        src={image.src}
        alt={image.alt || "Selected photo"}
        width={w}
        height={h}
        sizes={SHARP_SIZES}
        quality={FRAME_QUALITY}
        priority
        className="en-gal-frame-img"
        draggable={false}
      />
      <Image
        src={image.src}
        alt=""
        width={w}
        height={h}
        sizes={SHARP_SIZES}
        quality={SHARP_QUALITY}
        priority
        draggable={false}
        onLoad={() => setSharpReady(true)}
        className={`en-gal-sharp${sharpReady ? " is-ready" : ""}`}
      />
    </div>
  );
}

function ExpandView({ items, index, onIndex, onClose, reduceMotion }) {
  const image = items[index];
  const [saving, setSaving] = useState(false);
  const touchRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        onIndex((index + 1) % items.length);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onIndex((index - 1 + items.length) % items.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  useEffect(() => {
    prefetchSharp(image.src);
    const next = items[(index + 1) % items.length];
    const prev = items[(index - 1 + items.length) % items.length];
    if (next) prefetchSharp(next.src);
    if (prev) prefetchSharp(prev.src);
  }, [image, index, items]);

  useEffect(() => {
    const strip = document.querySelector(".en-gal-expand-strip");
    const active = strip?.querySelector(".en-gal-expand-thumb.is-on");
    if (!strip || !active) return;
    const stripRect = strip.getBoundingClientRect();
    const thumbRect = active.getBoundingClientRect();
    const nextLeft =
      strip.scrollLeft + (thumbRect.left - stripRect.left) - stripRect.width / 2 + thumbRect.width / 2;
    strip.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [index, reduceMotion]);

  const onDownload = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await downloadOriginal(image.src);
    } finally {
      setSaving(false);
    }
  };

  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    if (!t) return;
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) onIndex((index + 1) % items.length);
    else onIndex((index - 1 + items.length) % items.length);
  };

  const stripIndexes = useMemo(() => {
    const out = [];
    const n = items.length;
    if (!n) return out;
    for (let d = -STRIP_WINDOW; d <= STRIP_WINDOW; d++) {
      out.push((index + d + n * 8) % n);
    }
    return out;
  }, [index, items.length]);

  return (
    <div
      className="en-gal-expand"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Photo"}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <motion.button
        type="button"
        className="en-gal-expand-scrim"
        aria-label="Close"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      <div className="en-gal-expand-chrome">
        <p className="en-gal-expand-count">
          {index + 1} / {items.length}
        </p>
        <div className="en-gal-expand-actions">
          <button
            type="button"
            onClick={() => onIndex((index - 1 + items.length) % items.length)}
            aria-label="Previous photo"
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
            <span>Prev</span>
          </button>
          <button
            type="button"
            onClick={() => onIndex((index + 1) % items.length)}
            aria-label="Next photo"
          >
            <span>Next</span>
            <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={saving}
            aria-busy={saving}
            aria-label="Download original photo"
          >
            <Download size={18} aria-hidden="true" />
            <span>{saving ? "…" : "Save"}</span>
          </button>
          <button type="button" className="en-gal-expand-close" onClick={onClose} aria-label="Close">
            <X size={22} strokeWidth={2} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>

      <motion.div
        key={image.id}
        className="en-gal-expand-body"
        initial={reduceMotion ? false : { opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <ExpandPhoto image={image} />
      </motion.div>

      <div className="en-gal-expand-strip" aria-label="Nearby photos">
        {stripIndexes.map((i) => {
          const item = items[i];
          const active = i === index;
          return (
            <button
              key={`${item.id}-${i}`}
              type="button"
              className={`en-gal-expand-thumb${active ? " is-on" : ""}`}
              onPointerEnter={() => prefetchSharp(item.src)}
              onClick={() => onIndex(i)}
              aria-label={item.alt || `Photo ${i + 1}`}
              aria-current={active ? "true" : undefined}
            >
              <span className="en-gal-media en-gal-expand-thumb-media">
                {active ? (
                  <span className="en-gal-expand-thumb-spacer" aria-hidden="true" />
                ) : (
                  <Image
                    src={item.src}
                    alt=""
                    fill
                    sizes="104px"
                    quality={THUMB_QUALITY}
                    loading="lazy"
                    decoding="async"
                    className="en-gal-tile-img"
                    draggable={false}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** `index` null = closed. Items: { id, src, alt, width, height }. */
export default function EnclaveLightbox({ items, index, onIndex, onClose }) {
  const reduceMotion = useReducedMotion();
  const [portalReady, setPortalReady] = useState(false);
  const expanded = index != null;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Freeze page scroll under the popover — do not remount or hide what is underneath.
  useEffect(() => {
    if (!expanded) return undefined;
    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevOverscroll = style.overscrollBehavior;
    style.overflow = "hidden";
    style.overscrollBehavior = "none";
    return () => {
      style.overflow = prevOverflow;
      style.overscrollBehavior = prevOverscroll;
    };
  }, [expanded]);

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {expanded ? (
        <motion.div
          key="expand"
          className="en-gal-lightbox"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <ExpandView
            items={items}
            index={index}
            onIndex={onIndex}
            onClose={onClose}
            reduceMotion={reduceMotion}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
