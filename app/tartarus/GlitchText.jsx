"use client";

import { useEffect, useRef, useState } from "react";

const DECAY = ["░", "▒", "▓", "█", "▄", "▀", "∙", "▪", "·"];

export default function GlitchText({
  as: Tag = "span",
  text,
  children,
  className = "",
  interval = 2800,
  ...props
}) {
  const raw = text ?? (typeof children === "string" ? children : "");
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const [hits, setHits] = useState([]);
  const chars = Array.from(raw);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOn(true);
      return undefined;
    }

    const show = () => setOn(true);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            show();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) show();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!on) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;

    const live = chars
      .map((ch, index) => (ch.trim() ? index : -1))
      .filter((index) => index >= 0);

    if (!live.length) return undefined;

    let clearGlyphs = 0;
    let clearHits = 0;

    const tick = () => {
      const count = Math.min(live.length, 1 + Math.floor(Math.random() * 3));
      const pool = [...live];
      const picked = [];
      for (let i = 0; i < count; i += 1) {
        const at = Math.floor(Math.random() * pool.length);
        const index = pool.splice(at, 1)[0];
        picked.push({
          index,
          glyph: Math.random() > 0.28 ? DECAY[Math.floor(Math.random() * DECAY.length)] : null,
        });
      }
      setHits(picked);
      window.clearTimeout(clearGlyphs);
      window.clearTimeout(clearHits);
      clearGlyphs = window.setTimeout(() => {
        setHits((current) => current.map((hit) => ({ ...hit, glyph: null })));
      }, 90);
      clearHits = window.setTimeout(() => setHits([]), 240);
    };

    const id = window.setInterval(tick, interval);
    const first = window.setTimeout(tick, 640);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
      window.clearTimeout(clearGlyphs);
      window.clearTimeout(clearHits);
    };
  }, [on, interval, raw]);

  const hitAt = (index) => hits.find((hit) => hit.index === index);

  let offset = 0;
  const words = raw.split(/(\s+)/);

  return (
    <Tag ref={ref} className={["t-glitch", on ? "is-on" : "", className].filter(Boolean).join(" ")} {...props}>
      <span className="sr-only">{raw}</span>
      {words.map((word, wordIndex) => {
        if (/^\s+$/.test(word)) {
          offset += word.length;
          return (
            <span key={`s-${wordIndex}`} className="t-letter" aria-hidden="true">
              {"\u00A0"}
            </span>
          );
        }

        const start = offset;
        offset += word.length;

        return (
          <span key={`w-${wordIndex}`} className="t-word" aria-hidden="true">
            {Array.from(word).map((ch, letterIndex) => {
              const index = start + letterIndex;
              const hit = hitAt(index);
              return (
                <span
                  key={index}
                  className={["t-letter", hit ? "is-hit" : "", hit?.glyph ? "is-decay" : ""].filter(Boolean).join(" ")}
                >
                  {hit?.glyph ?? ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}
