"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-cream/80 px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-cream hover:text-soil active:scale-[0.98]";
const btnDark =
  "inline-flex items-center justify-center rounded-full bg-soil px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-navy active:scale-[0.98]";

// Absolute hrefs so the header works on every page, not just the home page.
// Desktop already shows an Events pill beside "Join the club", so this one only
// appears in the phone menu, where that pill is hidden.
const navItems = [
  ["/#about", "About"],
  ["/#events", "Events", "md:hidden"],
  ["/gallery", "Archive"],
  ["/#community", "Community"],
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("top");
    let frame = 0;

    const update = () => {
      frame = 0;
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      const nextScrolled = window.scrollY > 16;
      const nextOnHero = heroBottom > 140;
      setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
      setOnHero((current) => (current === nextOnHero ? current : nextOnHero));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
      update();
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const compact = scrolled || !onHero;
  const navLink = compact || menuOpen ? "text-soil/70 hover:text-soil" : "text-cream/80 hover:text-cream";

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div
        className={`mx-auto flex items-center justify-between transition-[padding,max-width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          compact ? "max-w-[1240px] px-4 pt-3 sm:px-5" : `${wrap} h-[58px] text-cream sm:h-[64px]`
        }`}
      >
        <div
          className={`flex items-center transition-[background-color,box-shadow,padding,border-radius] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            compact ? "rounded-full bg-white py-1.5 pl-2.5 pr-2 shadow-[0_8px_30px_rgba(65,51,51,0.1)] md:pr-5" : ""
          }`}
        >
          <a className="relative z-50 flex shrink-0 items-center" href="/#top" aria-label="Neural Tech home">
            <Image src="/neural-tech-logo1.png" alt="" width={36} height={36} sizes="36px" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
          </a>
          <nav
            className={`${
              menuOpen ? "flex" : "hidden"
            } absolute inset-x-4 top-[4.25rem] flex-col gap-4 rounded-2xl bg-white px-5 py-6 text-soil shadow-[0_12px_40px_rgba(65,51,51,0.12)] md:static md:ml-5 md:flex md:flex-row md:items-center md:gap-6 md:bg-transparent md:p-0 md:shadow-none md:text-inherit`}
            aria-label="Main navigation"
          >
            {navItems.map(([href, label, only = ""]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`${only} text-[0.88rem] font-normal transition-colors duration-200 ${menuOpen ? "text-soil/70 hover:text-soil" : navLink}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="relative z-50 flex items-center gap-2">
          {/* max-md:hidden, not `hidden md:inline-flex`: btnGhost carries its own
              inline-flex, which beat `hidden` and left this pill showing on phones. On
              phones, Events lives in the menu instead. */}
          <a
            className={`inline-flex max-md:hidden items-center rounded-full px-4 py-2 text-[0.82rem] font-normal transition-colors duration-200 ${
              compact ? "border border-soil/15 bg-white text-soil hover:border-soil" : btnGhost
            }`}
            href="/#events"
          >
            Events
          </a>
          {/* The one CTA that stays in the bar at every width. */}
          <a className={compact ? btnDark : btnFill} href="/#join">
            Join the club
          </a>
          <button
            className={`border-0 p-2 md:hidden ${compact ? "rounded-full bg-white text-soil shadow-[0_8px_30px_rgba(65,51,51,0.1)]" : "bg-transparent text-inherit"}`}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
