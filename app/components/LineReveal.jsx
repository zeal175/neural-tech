"use client";

import { useEffect, useRef, useState } from "react";

export default function LineReveal({
  as: Tag = "h2",
  className = "",
  lines = [],
  delay = 0,
  stagger = 90,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const show = () => setVisible(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
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
      { threshold: [0, 0.15, 0.3], rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) show();

    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, index) => (
        <span key={index} className="block overflow-hidden">
          <span
            className={`block transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:translate-y-0 ${
              visible ? "translate-y-0" : "translate-y-[115%]"
            }`}
            style={{ transitionDelay: visible ? `${delay + index * stagger}ms` : "0ms" }}
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
