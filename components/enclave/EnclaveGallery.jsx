"use client";

/**
 * Enclave gallery — Pinterest grid + expand.
 * Tuned for large sets: progressive mount, lazy thumbs, windowed strip.
 * Expand is a fixed overlay so closing restores the exact scroll position.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import "./enclave-gallery.css";

const FALLBACK = [
  {
    id: "poster",
    src: "/enclave/poster.jpg",
    alt: "ENCLAVE event poster",
    width: 833,
    height: 1024,
  },
  {
    id: "hero-desktop",
    src: "/enclave/hero/still-desktop.webp",
    alt: "ENCLAVE hero still",
    width: 1600,
    height: 1000,
  },
  {
    id: "bust-desktop",
    src: "/enclave/bust-desktop.webp",
    alt: "ENCLAVE bust",
    width: 1200,
    height: 1500,
  },
];

const THUMB_SIZES =
  "(max-width: 560px) 50vw, (max-width: 800px) 33vw, (max-width: 1100px) 25vw, 20vw";
const THUMB_QUALITY = 55;
const SHARP_SIZES = "100vw";
const SHARP_QUALITY = 88;
const FRAME_QUALITY = 75;
const INITIAL_BATCH = 36;
const LOAD_BATCH = 28;
const STRIP_WINDOW = 12;
const AHEAD_COUNT = 12;
/** px/ms — above this we wait; above rush we skip forced preload */
const SCROLL_BUSY = 1.4;
const SCROLL_RUSH = 3.2;

const warmed = new Set();
const thumbsWarmed = new Set();

function imageOptimizerUrl(src, width, quality) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

function prefetchSharp(src) {
  if (warmed.has(src) || typeof window === "undefined") return;
  warmed.add(src);
  const img = new window.Image();
  img.decoding = "async";
  img.src = imageOptimizerUrl(src, 1920, SHARP_QUALITY);
}

/** Warm the next thumbs at normal priority — never rush. */
function prefetchThumb(src) {
  if (thumbsWarmed.has(src) || typeof window === "undefined") return;
  thumbsWarmed.add(src);
  const img = new window.Image();
  img.decoding = "async";
  if ("fetchPriority" in img) img.fetchPriority = "low";
  img.src = imageOptimizerUrl(src, 640, THUMB_QUALITY);
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

function useColumnCount() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const w = window.innerWidth;
      setCount(w >= 1100 ? 4 : w >= 800 ? 3 : 2);
    };
    const onResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return count;
}

function packColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
  items.forEach((item) => {
    const ratio = item.width && item.height ? item.height / item.width : 1.15;
    const shortest = columns.reduce((a, b) => (a.height <= b.height ? a : b));
    shortest.items.push(item);
    shortest.height += ratio;
  });
  return columns.map((c) => c.items);
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

function Tile({ image, priority, reduceMotion, staggerMs = 0, onOpen }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => Boolean(priority || reduceMotion));
  const w = image.width || 0;
  const h = image.height || 0;
  const ratio = w > 0 && h > 0 ? `${w} / ${h}` : "4 / 3";
  const landscape = w > 0 && h > 0 && w >= h;

  useEffect(() => {
    if (inView) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    let timer = 0;
    const reveal = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setInView(true), staggerMs);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 40) reveal();

    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [inView, staggerMs]);

  return (
    <button
      ref={ref}
      type="button"
      data-gal-index={image.index}
      className={`en-gal-tile en-gal-tile-grid en-gal-tile-${landscape ? "landscape" : "portrait"}${inView ? " is-in" : ""}`}
      onPointerEnter={() => prefetchSharp(image.src)}
      onPointerDown={() => prefetchSharp(image.src)}
      onClick={() => onOpen(image.index)}
      aria-label={image.alt || "Open photo"}
    >
      <span className="en-gal-tile-wrap">
        <span className="en-gal-media" style={{ aspectRatio: ratio }}>
          <Image
            src={image.src}
            alt={image.alt || "Gallery photo"}
            fill
            sizes={THUMB_SIZES}
            quality={THUMB_QUALITY}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="en-gal-tile-img"
            draggable={false}
          />
        </span>
      </span>
    </button>
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

export default function EnclaveGallery({
  photos = [],
  variant = "section",
}) {
  const reduceMotion = useReducedMotion();
  const columnCount = useColumnCount();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef(null);
  const gridRef = useRef(null);
  const scrollVelRef = useRef(0);
  const itemsRef = useRef([]);
  const visibleCountRef = useRef(INITIAL_BATCH);
  const expanded = selectedIndex != null;
  const isPage = variant === "page";
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const items = useMemo(() => {
    const list = photos.length
      ? photos.map((photo, index) => ({
          id: photo.file || `photo-${index + 1}`,
          index,
          src: photo.src,
          alt: photo.alt || photo.caption || `ENCLAVE photo ${index + 1}`,
          width: photo.width || 1200,
          height: photo.height || 900,
        }))
      : FALLBACK.map((item, index) => ({ ...item, index }));
    return list;
  }, [photos]);

  itemsRef.current = items;
  visibleCountRef.current = visibleCount;

  const visibleItems = useMemo(
    () => items.slice(0, Math.min(visibleCount, items.length)),
    [items, visibleCount],
  );
  const columns = useMemo(() => packColumns(visibleItems, columnCount), [visibleItems, columnCount]);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (!hasMore || expanded) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const rush = scrollVelRef.current >= SCROLL_RUSH;
        const step = rush ? Math.min(8, LOAD_BATCH) : LOAD_BATCH;
        setVisibleCount((n) => Math.min(itemsRef.current.length, n + step));
      },
      { rootMargin: "480px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, expanded, visibleCount]);

  useEffect(() => {
    if (expanded || typeof window === "undefined") return undefined;

    let lastY = window.scrollY;
    let lastT = performance.now();
    let timer = 0;
    let raf = 0;

    const warmAhead = () => {
      const grid = gridRef.current;
      const list = itemsRef.current;
      if (!grid || !list.length) return;

      const tiles = grid.querySelectorAll("[data-gal-index]");
      if (!tiles.length) return;

      const edge = window.innerHeight + 120;
      let lastVisible = -1;
      for (let i = 0; i < tiles.length; i++) {
        const top = tiles[i].getBoundingClientRect().top;
        if (top < edge) {
          const idx = Number(tiles[i].getAttribute("data-gal-index"));
          if (Number.isFinite(idx) && idx > lastVisible) lastVisible = idx;
        }
      }
      if (lastVisible < 0) return;

      const needThrough = Math.min(list.length, lastVisible + 1 + AHEAD_COUNT);
      if (needThrough > visibleCountRef.current) {
        setVisibleCount((n) => Math.min(list.length, Math.max(n, needThrough)));
      }

      for (let i = 1; i <= AHEAD_COUNT; i++) {
        const item = list[lastVisible + i];
        if (item) prefetchThumb(item.src);
      }
    };

    const scheduleWarm = () => {
      window.clearTimeout(timer);
      const v = scrollVelRef.current;
      if (v >= SCROLL_RUSH) {
        timer = window.setTimeout(scheduleWarm, 220);
        return;
      }
      const delay = v >= SCROLL_BUSY ? 180 : 50;
      timer = window.setTimeout(warmAhead, delay);
    };

    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(16, now - lastT);
      scrollVelRef.current = Math.abs(y - lastY) / dt;
      lastY = y;
      lastT = now;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        scheduleWarm();
      });
    };

    scheduleWarm();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [expanded]);

  // Freeze page scroll under the popover — do not remount or hide the grid.
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

  const openAt = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  const closeExpand = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  return (
    <section
      id="gallery"
      className={`en-gallery${isPage ? " en-gallery-page" : ""}${expanded ? " is-expanded" : ""}`}
      aria-label="ENCLAVE gallery"
    >
      <div className="en-gallery-inner">
        <div className="en-gal-stage-wrap">
          <div
            className="en-gal-view en-gal-view-grid"
            aria-hidden={expanded || undefined}
            {...(expanded ? { inert: true } : {})}
          >
            <div ref={gridRef} className="en-gal-grid" aria-label="Photo wall">
              {columns.map((column, colIndex) => (
                <div key={colIndex} className="en-gal-grid-col">
                  {column.map((image, imageIndex) => (
                    <Tile
                      key={image.id}
                      image={image}
                      priority={colIndex < 2 && imageIndex < 2}
                      reduceMotion={reduceMotion}
                      staggerMs={reduceMotion ? 0 : (imageIndex % 3) * 45 + colIndex * 20}
                      onOpen={openAt}
                    />
                  ))}
                </div>
              ))}
            </div>
            {hasMore ? (
              <div ref={sentinelRef} className="en-gal-sentinel" aria-hidden="true" />
            ) : null}
          </div>
        </div>
      </div>

      {portalReady
        ? createPortal(
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
                    index={selectedIndex}
                    onIndex={setSelectedIndex}
                    onClose={closeExpand}
                    reduceMotion={reduceMotion}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}
