"use client";

import { useEffect, useState } from "react";
import SphereImageGrid from "@/components/ui/image-sphere";

const BASE_IMAGES = [
  {
    src: "/neural-tech-logo1.png",
    alt: "Neural Tech mark",
    title: "Neural Tech",
    description: "The club mark. Brain, network, same organism.",
  },
  {
    src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
    alt: "Circuits",
    title: "Circuits",
    description: "Hardware under the hood.",
  },
  {
    src: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=400&q=80",
    alt: "AI form",
    title: "Models",
    description: "Forms the club keeps poking.",
  },
  {
    src: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80",
    alt: "Robot",
    title: "Robotics",
    description: "One of the five frequencies.",
  },
  {
    src: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80",
    alt: "Machines",
    title: "Machines",
    description: "Humans building with them.",
  },
  {
    src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80",
    alt: "Code rain",
    title: "Code",
    description: "The frequency that stays up late.",
  },
  {
    src: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=400&q=80",
    alt: "Editor",
    title: "Build nights",
    description: "Half-formed demos, no portfolio required.",
  },
  {
    src: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=400&q=80",
    alt: "Desk",
    title: "Studio",
    description: "The room that does not empty.",
  },
  {
    src: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=400&q=80",
    alt: "Laptop",
    title: "Research",
    description: "The frequency that actually reads.",
  },
  {
    src: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=400&q=80",
    alt: "Programming",
    title: "Tartarus",
    description: "Four layers. One scoreboard.",
  },
];

const IMAGES = Array.from({ length: 36 }, (_, i) => {
  const base = BASE_IMAGES[i % BASE_IMAGES.length];
  return {
    id: `club-${i + 1}`,
    ...base,
    alt: `${base.alt} ${Math.floor(i / BASE_IMAGES.length) + 1}`,
  };
});

function useSphereSize(max = 600) {
  const [size, setSize] = useState(max);

  useEffect(() => {
    const update = () => {
      const available = Math.min(window.innerWidth - 24, window.innerHeight * 0.72);
      setSize((current) => {
        const next = Math.round(Math.max(280, Math.min(max, available)));
        return current === next ? current : next;
      });
    };

    let frame = 0;
    const onResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [max]);

  return size;
}

export default function ClubSleepMarquee() {
  const containerSize = useSphereSize(600);

  return (
    <SphereImageGrid
      images={IMAGES}
      containerSize={containerSize}
      sphereRadius={Math.round(containerSize * 0.333)}
      dragSensitivity={0.8}
      momentumDecay={0.96}
      maxRotationSpeed={6}
      baseImageScale={0.15}
      hoverScale={1.3}
      perspective={1000}
      autoRotate
      autoRotateSpeed={0.2}
    />
  );
}
