"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Coordinate space of the curve the chips ride along; the component scales it to fit.
const VIEW_BOX = "0 0 1040 190";
// Chips ride the curve anchored at their centre, so the path stays well inside the box
// on both axes — otherwise the first and last chips get clipped at the edges.
const PATH = "M92,128 C260,54 400,152 560,104 C720,56 812,144 948,82";

export default function MarqueeHero({ items }) {
  const [Curved, setCurved] = useState(null);
  const wrapRef = useRef(null);

  // The curve is a wide-screen flourish, so the motion library that drives it is only
  // fetched when it will actually run. Phones and reduced-motion viewers render the
  // server's static row and download nothing extra.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (wrap.clientWidth < 640) return undefined;

    let alive = true;
    import("@/components/ui/marquee-along-svg-path").then((module) => {
      if (alive) setCurved(() => module.default);
    });

    // Scroll velocity leans the whole strip, so it reacts to how hard you scroll.
    let frame = 0;
    let velocity = 0;
    let last = window.scrollY;

    const loop = () => {
      frame = 0;
      velocity *= 0.86;
      const skew = Math.max(-5, Math.min(5, velocity * 0.12));
      wrap.style.setProperty("--mq-skew", `${skew.toFixed(2)}deg`);
      if (Math.abs(velocity) > 0.25) frame = window.requestAnimationFrame(loop);
      else wrap.style.setProperty("--mq-skew", "0deg");
    };

    const onScroll = () => {
      const y = window.scrollY;
      velocity += y - last;
      last = y;
      if (!frame) frame = window.requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      alive = false;
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Kept narrow on purpose: wide chips overlap each other along the curve.
  const chips = items.map((item) => (
    <span className="ar-chip" key={item.title} style={item.tokens}>
      {item.mark ? <Image src={item.mark} alt="" width={34} height={34} sizes="34px" /> : null}
      <b>{item.title}</b>
    </span>
  ));

  return (
    <div className="ar-marquee" data-rolling={Curved ? "true" : "false"} ref={wrapRef} aria-hidden="true">
      {Curved ? (
        <Curved
          path={PATH}
          viewBox={VIEW_BOX}
          width="100%"
          height="100%"
          baseVelocity={3.4}
          repeat={items.length < 3 ? 4 : 3}
          slowdownOnHover
          slowDownFactor={0.22}
          draggable
          dragSensitivity={0.12}
          grabCursor
          enableRollingZIndex={false}
          responsive
        >
          {chips}
        </Curved>
      ) : (
        <div className="ar-marquee-static">{chips}</div>
      )}
    </div>
  );
}
