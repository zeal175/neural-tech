"use client";

import { useEffect, useRef } from "react";

/** Reveal on scroll — ~300ms wipe, optional delay so siblings play in order. */
export default function RevealCell({
  as: Tag = "div",
  dir = "down",
  delay = 0,
  className = "",
  children,
  ...props
}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let timer = 0;
    const show = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => node.classList.add("is-in"), delay);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-in");
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            io.unobserve(node);
            break;
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
    );

    io.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.82 && rect.bottom > 60) show();

    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [delay]);

  return (
    <Tag ref={ref} className={`en-wipe en-wipe-${dir} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
}
