"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Seen from "./Seen";
import GlitchText from "./GlitchText";

// The run is over, so every call to action now points at this event's photo gallery.
const ARCHIVE = "/gallery/tartarus";

const challenges = [
  {
    id: "gate",
    n: "01",
    call: "GATE",
    hook: "There's a sentry. It talks. It hates the word “key.”",
    copy: "You need four things sitting behind a very polite, very hostile front desk. Asking for them by name is how you lose. Sound like you belong, poke at the boring edges — length, prefix, status, the stuff a real check would ask — and walk out with the fragments anyway. There is no magic sentence. There is only sounding like you were supposed to be here.",
    beats: [
      "Read the clue. Then phrase the ask yourself.",
      "Look official. Inspect the edges. Never ask for the key.",
      "Four fragments. One guard. No shortcuts.",
    ],
  },
  {
    id: "vault",
    n: "02",
    call: "VAULT",
    hook: "The archive is sick. Name the disease, then pick the lock.",
    copy: "Sealed memories. Each one starts as a pile of symptoms — not a textbook title. Figure out what you're looking at, say it out loud, and a second lock appears that only your team can open. A copied code from the table next to you will bounce. Do the reading. Then do the work.",
    beats: [
      "Symptoms first. Name the concept.",
      "Your unlock is yours. Theirs will not work on your lock.",
      "Skimming is how you stay stuck.",
    ],
  },
  {
    id: "triage",
    n: "03",
    call: "TRIAGE",
    hook: "Four machines were sabotaged. You are the night shift.",
    copy: "Something broke them on purpose. You get messy telemetry, disagreeing sensors, and three moves in order: diagnose, isolate, repair. The obvious answer is usually bait. Clicking at random is how the room laughs at you. Read the whole picture, then touch one thing.",
    beats: [
      "Diagnose the failure. Not the loudest chart.",
      "Isolate the guilty subsystem. Repair only that.",
      "Sensors lie. Repeating a wrong click does not become a right one.",
    ],
  },
  {
    id: "core",
    n: "04",
    call: "CORE",
    sealed: true,
    hook: "If we told you, it wouldn't be Core.",
    copy: "The first three you can study. This one you earn. Survive Gate, Vault, and Triage and the last door opens — no pamphlet, no practice round, no “here's what to expect.” That's the point. Come back when the other three are behind you.",
    beats: [
      "No briefing. On purpose.",
      "You'll know it when the door opens.",
      "Until then: don't peek. Don't guess. Don't skip ahead.",
    ],
  },
];

const pad = "relative z-10 px-5 py-28 sm:px-8 sm:py-36 md:px-[6vw] md:py-44 xl:mx-auto xl:max-w-[1440px] xl:px-16";

function ChallengeCarousel() {
  const [index, setIndex] = useState(0);
  const touchX = useRef(0);
  const slide = challenges[index];

  const go = useCallback((next) => {
    setIndex((current) => {
      const total = challenges.length;
      return (current + next + total) % total;
    });
  }, []);

  useEffect(() => {
    const ids = challenges.map((item) => item.id);
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      const at = ids.indexOf(hash);
      if (at >= 0) setIndex(at);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div
      className="mt-12 border border-[var(--t-olive)]"
      onTouchStart={(event) => {
        touchX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        const dx = event.changedTouches[0].clientX - touchX.current;
        if (dx > 48) go(-1);
        if (dx < -48) go(1);
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--t-olive)] px-4 py-3 sm:px-6">
        <button type="button" className="t-cta-ghost min-h-10 px-3" onClick={() => go(-1)} aria-label="Previous challenge">
          Prev
        </button>
        <GlitchText as="p" className="t-label m-0 text-center" text={`Challenge ${slide.n} / 04`} interval={3400} />
        <button type="button" className="t-cta-ghost min-h-10 px-3" onClick={() => go(1)} aria-label="Next challenge">
          Next
        </button>
      </div>

      <article
        key={slide.id}
        id={slide.id}
        className="grid grid-cols-1 gap-10 px-5 py-10 sm:px-8 md:grid-cols-[1fr_1fr] md:items-start md:gap-14 md:px-10 md:py-14"
      >
        <div>
          <span
            className="t-chip"
            style={
              slide.sealed
                ? { color: "var(--t-amber)", borderColor: "var(--t-amber)" }
                : undefined
            }
          >
            {slide.sealed ? "Challenge 04 // sealed" : `Challenge ${slide.n}`}
          </span>
          <GlitchText
            as="h3"
            className="t-display mt-5 mb-4 text-[clamp(2.6rem,8vw,5rem)] text-[var(--t-phosphor)]"
            text={slide.call}
            interval={2200}
          />
          <GlitchText as="p" className="m-0 max-w-[36ch] text-[1.15rem] leading-[1.45] text-[var(--t-bone)]" text={slide.hook} />
        </div>
        <div>
          <GlitchText as="p" className="m-0 max-w-[52ch] text-[1.05rem] leading-[1.7] text-[var(--t-ash)]" text={slide.copy} interval={3100} />
          <ul className="mt-8 mb-0 list-none p-0">
            {slide.beats.map((beat) => (
              <li key={beat} className="border-t border-[var(--t-olive)] py-4 last:border-b last:border-[var(--t-olive)]">
                <GlitchText as="p" className="m-0 text-[1rem] leading-[1.6] text-[var(--t-bone)]" text={beat} interval={3600} />
              </li>
            ))}
          </ul>
        </div>
      </article>

      <div className="flex justify-center gap-2 border-t border-[var(--t-olive)] px-4 py-4">
        {challenges.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Show ${item.call}`}
            aria-current={itemIndex === index ? "true" : undefined}
            onClick={() => setIndex(itemIndex)}
            className="h-2 w-8 border-0 p-0"
            style={{
              background: itemIndex === index ? "var(--t-phosphor)" : "var(--t-olive)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function TartarusPage() {
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
    <main className="relative z-10 min-h-[100svh] bg-transparent text-[var(--t-bone)]">
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-[56px] items-center justify-between px-5 sm:h-[60px] md:px-[6vw] xl:px-16 ${
          scrolled || menuOpen ? "border-b border-[var(--t-olive)] bg-[var(--t-void)]" : "border-b border-transparent"
        }`}
      >
        <a className="t-display relative z-50 text-[1.35rem] tracking-[0.12em] text-[var(--t-phosphor)]" href="#top">
          TARTARUS
        </a>

        <nav
          className={`${
            menuOpen ? "flex" : "hidden"
          } absolute inset-x-0 top-[55px] flex-col gap-5 border-b border-[var(--t-olive)] bg-[var(--t-void)] px-5 py-6 sm:top-[59px] md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0`}
          aria-label="Brochure navigation"
        >
          <a href="#brief" onClick={() => setMenuOpen(false)} className="t-label transition-colors hover:text-[var(--t-phosphor)]">
            Brief
          </a>
          <a href="#rounds" onClick={() => setMenuOpen(false)} className="t-label transition-colors hover:text-[var(--t-phosphor)]">
            Challenges
          </a>
          <a href="/gallery" onClick={() => setMenuOpen(false)} className="t-label transition-colors hover:text-[var(--t-phosphor)]">
            Archive
          </a>
          <div className="md:hidden">
            <a className="t-cta" href={ARCHIVE} onClick={() => setMenuOpen(false)}>
              Photos
            </a>
          </div>
        </nav>

        <div className="relative z-50 hidden md:block">
          <a className="t-cta" href={ARCHIVE}>
            Photos
          </a>
        </div>

        <button
          className="relative z-50 border border-[var(--t-olive)] bg-transparent px-2.5 py-1.5 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="t-label">{menuOpen ? "Close" : "Menu"}</span>
        </button>
      </header>

      <div className="relative z-30 mt-[56px] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-y border-[var(--t-olive)] bg-[var(--t-depth)] px-5 py-2.5 text-center sm:mt-[60px]">
        <p className="t-label m-0" style={{ color: "var(--t-amber)" }}>
          Tartarus // run complete
        </p>
        <a className="t-label transition-colors hover:text-[var(--t-phosphor)]" href={ARCHIVE}>
          Files recovered →
        </a>
      </div>

      <section id="top" className="relative isolate min-h-[100svh] overflow-hidden bg-[var(--t-void)]">
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div className="h-[min(83vh,756px)] w-[min(96vw,756px)] sm:h-[min(94vh,936px)] sm:w-[min(94vw,864px)]">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="t-hero-video h-full w-full object-contain object-center"
            >
              <source src="/Pixel%20Figure.mp4" type="video/mp4" />
            </video>
          </div>
        </div>

        <div className="relative z-20 flex min-h-[100svh] flex-col items-center justify-between px-5 pt-12 pb-10 text-center sm:px-8 sm:pb-14 md:px-[6vw]">
          <div>
            <p className="t-label mb-3 flex items-center justify-center gap-2 text-[var(--t-phosphor)] [text-shadow:0_0_18px_#030303]">
              <i className="t-pulse inline-block" aria-hidden="true" />
              <GlitchText text="Neural Tech // run complete" interval={4000} />
            </p>
            <GlitchText
              as="h1"
              className="t-display m-0 text-[clamp(3.4rem,14vw,9rem)] text-[var(--t-phosphor)] [text-shadow:0_0_24px_#030303,0_0_4px_#030303]"
              text="TARTARUS"
              interval={1800}
            />
          </div>

          <div className="flex flex-col items-center">
            <GlitchText
              as="p"
              className="m-0 max-w-[28ch] text-[1.2rem] leading-[1.3] text-[var(--t-bone)] [text-shadow:0_0_18px_#030303]"
              text="The system fights back."
              interval={2500}
            />
            <a className="t-cta mt-6" href={ARCHIVE}>
              See what survived
            </a>
          </div>
        </div>
      </section>

      <section id="brief" className={`border-t border-[var(--t-olive)] bg-[var(--t-depth)] ${pad}`}>
        <Seen className="mx-auto max-w-[720px] text-center">
          <GlitchText as="p" className="t-label" text="01 // The event" interval={3800} />
          <GlitchText
            as="h2"
            className="t-display mt-5 m-0 text-[clamp(2.4rem,7vw,4.6rem)]"
            text="One day. Four challenges. No safety net."
            interval={2400}
          />
          <GlitchText
            as="p"
            className="mx-auto mt-8 max-w-[54ch] text-[1.1rem] leading-[1.7] text-[var(--t-ash)]"
            text="Tartarus is Neural Tech’s live AI competition — not a hackathon, not a lecture. Teams of up to two spend the day inside a hostile system: talk past it, recover what it hid, and repair what it broke. No entry fee. Real cash prize. Talo’s is watching."
          />
        </Seen>
      </section>

      <section id="penalty" className={`border-t border-[var(--t-olive)] ${pad}`}>
        <Seen className="mx-auto max-w-[720px] text-center">
          <GlitchText as="p" className="t-label" style={{ color: "var(--t-amber)" }} text="02 // The catch" interval={3600} />
          <GlitchText
            as="h2"
            className="t-display mt-5 m-0 text-[clamp(2.4rem,7vw,4.6rem)]"
            text="Bad calls have a secret encore."
            interval={2300}
          />
          <GlitchText
            as="p"
            className="mx-auto mt-8 max-w-[46ch] text-[1.1rem] leading-[1.7] text-[var(--t-ash)]"
            text="Tartarus doesn't send you to time-out. It opens a side door you didn't ask for — a penalty challenge, still classified. Guess too much, skip the reading, panic-click… and it finds you. We could spoil it. We won't. That's the fun part. For us."
          />
        </Seen>
      </section>

      <section id="rounds" className={`border-t border-[var(--t-olive)] bg-[var(--t-depth)] ${pad}`}>
        <Seen className="text-center">
          <GlitchText as="p" className="t-label" text="03 // The day" interval={3800} />
          <GlitchText
            as="h2"
            className="t-display mt-5 m-0 text-[clamp(2.4rem,7vw,4.6rem)]"
            text="Four challenges. One of them is a secret."
            interval={2400}
          />
          <GlitchText
            as="p"
            className="mx-auto mt-6 max-w-[44ch] text-[1.05rem] leading-[1.65] text-[var(--t-ash)]"
            text="Flip through Gate, Vault, and Triage. Core stays sealed until you earn it."
          />
        </Seen>
        <ChallengeCarousel />
      </section>

      <section id="after" className={`border-t border-[var(--t-olive)] ${pad} text-center`}>
        <Seen>
          <GlitchText as="p" className="t-label" text="04 // Aftermath" interval={3800} />
          <GlitchText
            as="h2"
            className="t-display mt-5 m-0 text-[clamp(2.4rem,7vw,4.6rem)]"
            text="It ran. It’s over. The files are up."
            interval={2300}
          />
          <GlitchText
            as="p"
            className="mx-auto mt-8 max-w-[44ch] text-[1.1rem] leading-[1.7] text-[var(--t-ash)]"
            text="Sign-ups are closed. This page stays as the record of what the day was. The photos are in the archive — take any of them with you."
          />
          <a className="t-cta mt-10" href={ARCHIVE}>
            Open the archive
          </a>
        </Seen>
      </section>

      <footer className="relative z-10 grid grid-cols-1 gap-4 border-t border-[var(--t-olive)] px-5 py-12 sm:px-8 md:grid-cols-3 md:items-center md:px-[6vw] md:py-16 xl:px-16">
        <a className="t-display text-[1.2rem] text-[var(--t-phosphor)]" href="#top">
          TARTARUS
        </a>
        <GlitchText as="p" className="t-label m-0" text="Neural Tech // one day // four challenges" interval={4200} />
        <a className="t-label hover:text-[var(--t-phosphor)] md:justify-self-end" href="/">
          Exit to club site
        </a>
      </footer>
    </main>
  );
}
