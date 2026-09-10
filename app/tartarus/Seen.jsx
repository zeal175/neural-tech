"use client";

import { useEffect, useRef, useState } from "react";

export default function Seen({ children, className = "", delay = 0, as: Tag = "div", ...props }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    const show = () => {
      frame = window.requestAnimationFrame(() => setOn(true));
    };

    if (typeof IntersectionObserver === "undefined") {
      show();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            show();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) show();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const d = delay === 1 ? "t-seen-d1" : delay === 2 ? "t-seen-d2" : delay === 3 ? "t-seen-d3" : "";

  return (
    <Tag ref={ref} className={["t-seen", on ? "is-on" : "", d, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Tag>
  );
}
