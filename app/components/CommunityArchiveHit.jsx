"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function CommunityArchiveHit({ children }) {
  const router = useRouter();
  const origin = useRef(null);

  const go = () => router.push("/gallery");

  return (
    <div
      className="relative min-h-[620px] w-full cursor-pointer md:min-h-[800px]"
      role="link"
      tabIndex={0}
      aria-label="Open the event archive"
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const start = origin.current;
        if (!start) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
        go();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          go();
        }
      }}
    >
      {children}
    </div>
  );
}
