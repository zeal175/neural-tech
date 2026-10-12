"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { whatsappUrl } from "@/lib/club-contact";

const pad = "relative z-10 px-5 py-28 sm:px-8 sm:py-36 md:px-[6vw] md:py-44 xl:mx-auto xl:max-w-[1440px] xl:px-16";

const REGISTER = whatsappUrl("Hi, I want in on Enclave.");

const DETAILS = [
  { label: "When", value: "Soon", note: "Date to be announced" },
  { label: "Where", value: "Crescent", note: "Venue to be announced" },
  { label: "Entry", value: "Solo or a pair", note: "One form. A pass each. QR at the door." },
];

export default function EnclavePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <main className="relative z-10 min-h-[100svh] bg-transparent text-[var(--e-cream)]">
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-[56px] items-center justify-between px-5 sm:h-[60px] md:px-[6vw] xl:px-16 ${
          scrolled || menuOpen ? "border-b border-[var(--e-line)] bg-[var(--e-ink)]" : "border-b border-transparent"
        }`}
      >
        <a className="e-display relative z-50 text-[1.2rem] text-[var(--e-ember)]" href="#top">
          ENCLAVE
        </a>

        <nav
          className={`${
            menuOpen ? "flex" : "hidden"
          } absolute inset-x-0 top-[55px] flex-col gap-5 border-b border-[var(--e-line)] bg-[var(--e-ink)] px-5 py-6 sm:top-[59px] md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0`}
          aria-label="Enclave navigation"
        >
          <a href="#brief" onClick={() => setMenuOpen(false)} className="e-label transition-colors hover:text-[var(--e-ember)]">
            Brief
          </a>
          <a href="#register" onClick={() => setMenuOpen(false)} className="e-label transition-colors hover:text-[var(--e-ember)]">
            Register
          </a>
          <a href="/events" onClick={() => setMenuOpen(false)} className="e-label transition-colors hover:text-[var(--e-ember)]">
            Events
          </a>
          <div className="md:hidden">
            <a
              className="e-cta"
              href={REGISTER}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              I want in
            </a>
          </div>
        </nav>

        <div className="relative z-50 hidden md:block">
          <a className="e-cta" href={REGISTER} target="_blank" rel="noopener noreferrer">
            I want in
          </a>
        </div>

        <button
          className="relative z-50 border border-[var(--e-line)] bg-transparent px-2.5 py-1.5 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="e-label">{menuOpen ? "Close" : "Menu"}</span>
        </button>
      </header>

      <div className="relative z-30 mt-[56px] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-y border-[var(--e-line)] bg-[var(--e-ink-2)] px-5 py-2.5 text-center sm:mt-[60px]">
        <p className="e-label m-0 text-[var(--e-ember)]">Enclave // upcoming</p>
        <a
          className="e-label transition-colors hover:text-[var(--e-ember)]"
          href={REGISTER}
          target="_blank"
          rel="noopener noreferrer"
        >
          Claim a seat →
        </a>
      </div>

      <section id="top" className="relative isolate min-h-[100svh] overflow-hidden bg-[var(--e-ink)]">
        <div className="pointer-events-none absolute inset-0 z-0 flex items-end justify-center">
          <div className="relative h-[min(88vh,820px)] w-[min(92vw,640px)]">
            <Image
              src="/enclave/cover.png"
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 92vw, 640px"
              quality={75}
              className="object-contain object-bottom"
            />
          </div>
        </div>

        <div className="relative z-20 flex min-h-[100svh] flex-col items-center justify-between px-5 pt-16 pb-10 text-center sm:px-8 sm:pb-14 md:px-[6vw]">
          <div>
            <p className="e-label mb-3 text-[var(--e-ember)]">Department of CSE presents</p>
            <h1 className="e-display m-0 text-[clamp(3.4rem,14vw,9rem)] text-[var(--e-cream)]">ENCLAVE</h1>
          </div>

          <div className="flex flex-col items-center">
            <p className="m-0 max-w-[24ch] text-[1.15rem] leading-[1.35] text-[var(--e-cream)]">Step inside.</p>
            <a className="e-cta mt-6" href="#register">
              The details
            </a>
          </div>
        </div>
      </section>

      <section id="brief" className={`border-t border-[var(--e-line)] bg-[var(--e-ink-2)] ${pad}`}>
        <div className="mx-auto max-w-[720px] text-center">
          <p className="e-label">01 // The event</p>
          <h2 className="e-display mt-5 text-[clamp(2.4rem,7vw,4.6rem)]">A different door.</h2>
          <p className="mx-auto mt-8 max-w-[48ch] text-[1.05rem] leading-[1.7] text-[var(--e-dim)]">
            Tartarus already ran. Enclave is next. Neural Tech’s next live day — not a workshop, not a
            take-home brief. Solo or a team of two. You get a pass. The QR is the door.
          </p>
        </div>
      </section>

      <section id="register" className={`border-t border-[var(--e-line)] ${pad}`}>
        <p className="e-label text-[var(--e-ember)]">The details</p>
        <h2 className="e-display mt-6 max-w-[16ch] text-[clamp(2.8rem,8vw,6.5rem)]">Step inside the Enclave.</h2>
        <dl className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {DETAILS.map((item) => (
            <div key={item.label} className="border-t border-[var(--e-line)] pt-5">
              <dt className="e-label">{item.label}</dt>
              <dd className="e-display mt-3 text-[clamp(1.7rem,3vw,2.6rem)] text-[var(--e-cream)]">{item.value}</dd>
              <dd className="mt-2 text-[0.92rem] leading-[1.6] text-[var(--e-dim)]">{item.note}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-4">
          <a className="e-cta" href={REGISTER} target="_blank" rel="noopener noreferrer">
            I want in
          </a>
          <p className="e-label">Seats are limited</p>
        </div>
      </section>

      <footer className="relative z-10 grid grid-cols-1 gap-4 border-t border-[var(--e-line)] px-5 py-12 sm:px-8 md:grid-cols-3 md:items-center md:px-[6vw] md:py-16 xl:px-16">
        <a className="e-display text-[1.2rem] text-[var(--e-ember)]" href="#top">
          ENCLAVE
        </a>
        <p className="e-label m-0">Neural Tech · CSE · Crescent</p>
        <a className="e-label hover:text-[var(--e-ember)] md:justify-self-end" href="/">
          Exit to club site
        </a>
      </footer>
    </main>
  );
}
