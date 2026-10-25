"use client";

/**
 * Full-page ENCLAVE gallery at /gallery/enclave — grid + expand.
 */
import Link from "next/link";
import Image from "next/image";
import EnclaveGallery from "@/components/enclave/EnclaveGallery";
import "./enclave-showcase.css";

export default function EnclaveShowcase({ event, photos = [] }) {
  return (
    <main className="enc-show">
      <header className="enc-show-nav">
        <Link href="/gallery" className="enc-show-back">
          ← Gallery
        </Link>
        <Link href={event.briefingHref || "/enclave"} className="enc-show-brief">
          Briefing →
        </Link>
      </header>

      <h1 className="sr-only">{event.title}</h1>

      <EnclaveGallery photos={photos} variant="page" />

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
