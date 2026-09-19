"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";

const SHOT_H = 150;
const PX_PER_SEC = 42;

function Shot({ photo }) {
  const width = photo.width || 3;
  const height = photo.height || 2;

  return (
    <a
      className="ar-film-shot"
      href={photo.href}
      style={{ aspectRatio: `${width} / ${height}`, width: `calc(var(--ar-shot-h, ${SHOT_H}px) * ${width} / ${height})` }}
    >
      <Image src={photo.src} alt="" fill sizes="240px" quality={60} className="object-cover" />
    </a>
  );
}

function Set({ photos, prefix }) {
  return (
    <div className="ar-film-set">
      {photos.map((photo, index) => (
        <Shot key={`${prefix}-${photo.src}-${index}`} photo={photo} />
      ))}
    </div>
  );
}

export default function MarqueeHero({ photos }) {
  const trackRef = useRef(null);
  const setRef = useRef(null);
  const items = useMemo(() => {
    if (!photos?.length) return [];
    if (photos.length >= 10) return photos;
    return Array.from({ length: 10 }, (_, i) => photos[i % photos.length]);
  }, [photos]);

  useEffect(() => {
    const track = trackRef.current;
    const first = setRef.current;
    if (!track || !first || !items.length) return undefined;

    let x = 0;
    let frame = 0;
    let last = performance.now();

    const tick = (now) => {
      const width = first.offsetWidth;
      const dt = Math.min(now - last, 48);
      last = now;
      if (width > 1) {
        x -= (PX_PER_SEC * dt) / 1000;
        if (x <= -width) x += width;
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  if (!items.length) return null;

  return (
    <div className="ar-film" aria-hidden="true">
      <div className="ar-film-track" ref={trackRef}>
        <div ref={setRef}>
          <Set photos={items} prefix="a" />
        </div>
        <Set photos={items} prefix="b" />
      </div>
    </div>
  );
}
