"use client";

/**
 * Full-page ENCLAVE gallery at /gallery/enclave — a scroll-driven 3D spiral, with the photo grid
 * as the fallback for reduced motion, no WebGL2, or a scene that fails to start.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import EnclaveGallery from "@/components/enclave/EnclaveGallery";
import HelixGallery from "@/components/enclave/helix/HelixGallery";
import { formatEventDate } from "./events";
import { pixel } from "./fonts";
import "./enclave-showcase.css";

function canSpiral() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return typeof window.WebGL2RenderingContext === "function";
}

export default function EnclaveShowcase({ event, photos = [] }) {
  // decided after mount (needs the browser); until then hold the stage's height
  const [mode, setMode] = useState(null);

  useEffect(() => {
    setMode(canSpiral() && photos.length > 1 ? "spiral" : "grid");
  }, [photos.length]);

  return (
    <main className={`enc-show ${pixel.variable}${mode === "spiral" ? " is-spiral" : ""}`}>
      <header className="enc-show-nav">
        <Link href="/gallery" className="enc-show-back">
          ← Gallery
        </Link>
        <Link href={event.briefingHref || "/enclave"} className="enc-show-brief">
          Briefing →
        </Link>
      </header>

      <h1 className="sr-only">{event.title}</h1>

      {mode === "spiral" ? (
        <HelixGallery
          event={event}
          dateLabel={formatEventDate(event.date)}
          photos={photos}
          onFail={() => setMode("grid")}
        />
      ) : mode === "grid" ? (
        <EnclaveGallery photos={photos} variant="page" />
      ) : (
        <div className="enc-show-pending" aria-hidden="true" />
      )}

      <footer className="enc-show-foot">
        <Link href="/" aria-label="Neural Tech home">
          <Image
            src="/neural-tech-logo2.png"
            alt="Neural Techgenix Club"
            width={200}
            height={58}
            sizes="200px"
            className="enc-show-logo"
          />
        </Link>
        <div className="enc-show-foot-links">
          <Link href="/gallery">All events</Link>
          {event.briefingHref ? <Link href={event.briefingHref}>{event.title}</Link> : null}
          <span>© 2026 Neural Tech</span>
        </div>
      </footer>
    </main>
  );
}
