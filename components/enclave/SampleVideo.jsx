"use client";

import { useEffect, useRef } from "react";

/** Loads and plays the sample clip only once it scrolls into view. */
export default function SampleVideo({ src, label = "Sample program", className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;

    let loaded = false;
    const arm = () => {
      if (loaded) return;
      loaded = true;
      video.preload = "metadata";
      if (!video.getAttribute("src")) video.src = src;
      video.load();
      const play = () => video.play().catch(() => {});
      if (video.readyState >= 2) play();
      else video.addEventListener("loadeddata", play, { once: true });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          arm();
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.05 },
    );
    io.observe(video);

    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label={label}
    />
  );
}
