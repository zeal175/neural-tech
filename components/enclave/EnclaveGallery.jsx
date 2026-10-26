"use client";

/**
 * Enclave gallery — Pinterest grid + expand.
 * Tuned for large sets: progressive mount, lazy thumbs, windowed strip.
 * Expand is a fixed overlay (EnclaveLightbox) so closing restores the exact scroll position.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import EnclaveLightbox, { imageOptimizerUrl, prefetchSharp, THUMB_QUALITY } from "./EnclaveLightbox";
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
const INITIAL_BATCH = 36;
const LOAD_BATCH = 28;
const AHEAD_COUNT = 12;
/** px/ms — above this we wait; above rush we skip forced preload */
const SCROLL_BUSY = 1.4;
const SCROLL_RUSH = 3.2;

const thumbsWarmed = new Set();

/** Warm the next thumbs at normal priority — never rush. */
function prefetchThumb(src) {
  if (thumbsWarmed.has(src) || typeof window === "undefined") return;
  thumbsWarmed.add(src);
  const img = new window.Image();
  img.decoding = "async";
  if ("fetchPriority" in img) img.fetchPriority = "low";
  img.src = imageOptimizerUrl(src, 640, THUMB_QUALITY);
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

      <EnclaveLightbox
        items={items}
        index={selectedIndex}
        onIndex={setSelectedIndex}
        onClose={closeExpand}
      />
    </section>
  );
}
