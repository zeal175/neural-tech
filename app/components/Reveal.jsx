"use client";

import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, className = "", delay = 0, as: Tag = "div", variant = "default", ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    const show = () => {
      frame = window.requestAnimationFrame(() => setVisible(true));
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
      {
        threshold: [0, 0.05, 0.1, 0.2],
        rootMargin: "0px 0px -5% 0px",
      },
    );

    observer.observe(node);

    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.95 && rect.bottom > 0;
    if (inView) show();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const delayMs = delay === 1 ? "delay-75" : delay === 2 ? "delay-150" : delay === 3 ? "delay-[220ms]" : delay === 4 ? "delay-300" : "delay-0";
  const card = variant === "card";
  const hero = variant === "hero";

  return (
    <Tag
      ref={ref}
      {...props}
      className={[
        "transition-[opacity,transform] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100",
        hero ? "duration-[1400ms]" : card ? "duration-700" : "duration-500",
        delayMs,
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : hero
            ? "scale-[1.12] opacity-0"
            : card
              ? "translate-y-8 scale-[0.97] opacity-0"
              : "translate-y-3 opacity-0",
        visible ? "" : "will-change-[opacity,transform]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
