"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV_EXTRAS = [
  ["/enclave", "Entrance"],
  ["/", "Club site"],
];

export default function SiteNav() {
  const pathname = usePathname();
  const onLanding = pathname === "/enclave" || pathname === "/enclave/";
  const onRegister = pathname.startsWith("/enclave/register");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pastHero, setPastHero] = useState(!onLanding);
  const [glitchIn, setGlitchIn] = useState(false);
  const wasPast = useRef(!onLanding);

  useEffect(() => {
    if (!onLanding) {
      setPastHero(true);
      wasPast.current = true;
      return undefined;
    }

    const hero = document.querySelector(".hero");
    if (!hero) {
      setPastHero(true);
      wasPast.current = true;
      return undefined;
    }

    let frame = 0;
    let glitchTimer = 0;
    const sync = () => {
      frame = 0;
      const next = hero.getBoundingClientRect().bottom <= 140;
      if (next && !wasPast.current) {
        setGlitchIn(true);
        window.clearTimeout(glitchTimer);
        glitchTimer = window.setTimeout(() => setGlitchIn(false), 520);
      }
      wasPast.current = next;
      setPastHero(next);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
      sync();
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(glitchTimer);
    };
  }, [onLanding]);

  const compact = pastHero;

  return (
    <header
      className={`en-nav${compact ? " is-past-hero" : " is-on-hero"}${menuOpen ? " is-menu-open" : ""}${
        glitchIn ? " is-glitch-in" : ""
      }`}
    >
      <div className="en-nav-shell">
        <div className="en-nav-cluster">
          <a className="en-nav-brand" href="/" aria-label="Neural Tech home">
            <img src="/enclave/brand/neural-tech-logo-96.webp" alt="" width={36} height={38} />
          </a>

          <nav className="en-nav-links" aria-label="Site">
            {NAV_EXTRAS.map(([href, label], i) => (
              <a
                key={href}
                href={href}
                className="en-nav-extra"
                style={{ "--en-nav-i": i }}
                onClick={() => setMenuOpen(false)}
              >
                <span className="en-nav-extra-label" data-text={label}>
                  {label}
                </span>
              </a>
            ))}
          </nav>

          {compact ? (
            <button
              type="button"
              className="en-nav-toggle"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          ) : null}
        </div>

        <div className="en-nav-cta-wrap">
          {!onRegister ? (
            <a className="en-nav-register" href="/enclave/register">
              Register
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
