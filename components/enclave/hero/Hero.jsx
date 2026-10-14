"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { loadPass } from "@/components/enclave/register/passStorage";
import { MODEL_URL, TEXTURES } from "@/lib/enclave/assets";
import { EVENT, WHEN_WHERE } from "@/lib/enclave/event";
import Countdown from "./Countdown";
import GlitchText from "./GlitchText";
import { SHOW_FIGURE, emit, live, useHero } from "./heroStore";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

// letter stagger only used when the 3D figure hero splits the wordmark on scroll
const LETTERS = EVENT.name.split("");
const PILLAR_ADVANCE = { E: 0.196, N: 0.211, C: 0.196, L: 0.154, A: 0.196, V: 0.196 };
const byLetter = (step) => (_, el) => Number(el.dataset.i) * step;

function FigureTitle({ titleRef }) {
  return (
    <h1 ref={titleRef} className="hero-title">
      <span className="sr-only">{EVENT.name}</span>
      <span aria-hidden="true">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            className="ch"
            data-i={i}
            style={PILLAR_ADVANCE[ch] ? { width: `${PILLAR_ADVANCE[ch]}em` } : undefined}
          >
            {ch}
          </span>
        ))}
      </span>
    </h1>
  );
}

function Toast() {
  const toast = useHero((s) => s.toast);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className={`hero-toast mono-label ${on ? "is-on" : ""}`} role="status" aria-live="polite">
      {toast?.text}
    </div>
  );
}

function Loader() {
  const progress = useHero((s) => s.progress);
  return (
    <div className="hero-loader" data-loader>
      <div className="flex flex-col items-center gap-4">
        <div className="hero-loader-bar" style={{ "--progress": progress / 100 }}>
          <span />
        </div>
        <span className="mono-label text-ember/70">Acquiring signal · {Math.round(progress)}%</span>
      </div>
    </div>
  );
}

export default function Hero() {
  const heroRef = useRef(null);
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const ctaRef = useRef(null);
  const titleRef = useRef(null);
  const [glitchPlay, setGlitchPlay] = useState(false);
  const [inView, setInView] = useState(true);
  const [fine, setFine] = useState(false);
  const [titleSize, setTitleSize] = useState(0.32);
  // the UI is painted from the first frame (under the opaque loader) but stays inert until the
  // intro takes over its visibility
  const [revealed, setRevealed] = useState(false);
  const ready = useHero((s) => s.ready);
  const webgl = useHero((s) => s.webgl);
  const reducedMotion = useHero((s) => s.reducedMotion);
  const setHero = useHero((s) => s.set);

  // Bigger wordmark scale on narrow screens (GlitchText size is relative to wrap width)
  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    const sync = () => setTitleSize(mq.matches ? 0.4 : 0.32);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // ---- capabilities -> quality tier
  useEffect(() => {
    const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isFine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const params = new URLSearchParams(location.search);
    const forceNoGL = params.has("nowebgl");
    const forcedTier = ["high", "mid", "low"].includes(params.get("tier")) ? params.get("tier") : null;
    let gl2 = null;
    try {
      gl2 = forceNoGL ? null : document.createElement("canvas").getContext("webgl2");
    } catch {
      gl2 = null;
    }
    const cores = navigator.hardwareConcurrency || 4;
    const small = matchMedia("(max-width: 820px)").matches;
    live.pointer.fine = isFine;
    setFine(isFine);
    if (!SHOW_FIGURE) {
      setHero({
        reducedMotion: rm,
        webgl: false,
        ready: true,
        tier: "low",
        tierLocked: !!forcedTier,
      });
      return;
    }
    setHero({
      reducedMotion: rm,
      webgl: !!gl2,
      tier: forcedTier || (small || cores <= 4 ? "mid" : "high"),
      tierLocked: !!forcedTier,
    });
    if (!gl2) setHero({ ready: true });
  }, [setHero]);

  // ---- 3D assets (~1.8 MB): requested once the first frame (title, date, under the loader) has
  // painted, so they don't compete with the fonts and scripts that frame needs. Started here
  // rather than in the 3D chunk so the download overlaps that chunk's; its loaders pick up the
  // preloaded responses.
  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    let raf = 0;
    const request = () => {
      if (live.assetsRequested) return; // the 3D chunk got there first
      live.assetsRequested = true;
      // the maps are fetched as ImageBitmaps where supported (Bust.jsx), else as <img>
      const mapAs = typeof createImageBitmap === "function" ? "fetch" : "image";
      for (const [href, as] of [[MODEL_URL, "fetch"], ...Object.values(TEXTURES).map((u) => [u, mapAs])]) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = as;
        link.href = href;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    };
    document.fonts.ready.then(() => {
      if (cancelled) return;
      // two frames: the second callback runs after the frame with the title has been painted
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(request)));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [webgl]);

  // (the giant title is fitted to the stage in CSS: .hero-title in globals.css)

  // ---- pointer: gaze target, custom cursor, parallax, clicks (figure hero only)
  useEffect(() => {
    if (!SHOW_FIGURE) return undefined;
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return undefined;
    const curX = gsap.quickTo(cursor, "x", { duration: 0.32, ease: "power3" });
    const curY = gsap.quickTo(cursor, "y", { duration: 0.32, ease: "power3" });
    const layers = stage.querySelectorAll("[data-parallax]");
    const lx = gsap.quickTo(layers, "x", { duration: 1.4, ease: "power3" });
    const ly = gsap.quickTo(layers, "y", { duration: 1.4, ease: "power3" });

    const toNdc = (e) => {
      const r = stage.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -(((e.clientY - r.top) / r.height) * 2 - 1),
        inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom,
      };
    };

    const onMove = (e) => {
      const p = toNdc(e);
      Object.assign(live.pointer, p, { lastMove: performance.now() });
      if (live.pointer.fine) {
        curX(e.clientX);
        curY(e.clientY);
        cursor.style.opacity = p.inside ? "1" : "0";
      }
      lx(-p.x * 14);
      ly(p.y * 8);
      stage.style.setProperty("--glow-x", `${52 + p.x * 7}%`);
      stage.style.setProperty("--glow-y", `${40 - p.y * 5}%`);
    };
    const onLeave = () => {
      live.pointer.inside = false;
      cursor.style.opacity = "0";
    };

    // press = start charging; quick release = click pulse (decided in the scene), long hold
    // released = big shockwave. A touch that turns into a drag is a gaze-steer, not a charge.
    let down = null;
    const onDown = (e) => {
      if (e.target.closest("a,button,input,select,.reg-root")) return;
      const p = toNdc(e);
      Object.assign(live.pointer, p, { lastMove: performance.now() });
      down = { x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse" };
      Object.assign(live.charge, { active: true, x: p.x, y: p.y, release: false, cancel: false });
      requestTilt();
    };
    const endPress = (cancel) => {
      if (!down) return;
      const touch = down.touch;
      down = null;
      Object.assign(live.charge, { active: false, release: true, cancel });
      // phones that support it: a short haptic kick for a charged release (stronger the longer
      // the hold), so the shockwave is felt as well as seen
      if (!cancel && touch && live.chargeLevel > 0.3) navigator.vibrate?.(Math.round(12 + live.chargeLevel * 28));
    };
    const onUp = () => endPress(false);
    const onCancel = () => endPress(true);
    const onDrag = (e) => {
      if (down?.touch && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) endPress(true);
    };
    const noMenu = (e) => live.charge.active && e.preventDefault();

    // phone tilt steers the gaze and the backlight (iOS asks permission on the first tap)
    let tiltBase = null;
    const onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      tiltBase ??= e.beta;
      live.tilt.x = Math.max(-1, Math.min(1, e.gamma / 35));
      live.tilt.y = Math.max(-1, Math.min(1, -(e.beta - tiltBase) / 30));
      live.tilt.active = true;
    };
    let tiltAsked = false;
    function requestTilt() {
      if (tiltAsked || live.pointer.fine || typeof DeviceOrientationEvent === "undefined") return;
      tiltAsked = true;
      const ask = DeviceOrientationEvent.requestPermission;
      if (typeof ask === "function") {
        ask()
          .then((r) => r === "granted" && window.addEventListener("deviceorientation", onTilt))
          .catch(() => {});
      }
    }
    if (!live.pointer.fine && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") {
      window.addEventListener("deviceorientation", onTilt);
    }

    // anything marked [data-gaze] draws the figure's eyes when hovered or focused
    const gazeAt = (el) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      Object.assign(live.gaze, {
        active: true,
        x: ((r.left + r.width / 2 - s.left) / s.width) * 2 - 1,
        y: -(((r.top + r.height / 2 - s.top) / s.height) * 2 - 1),
        ignite: el.dataset.gaze === "ignite",
      });
    };
    const onOver = (e) => {
      const el = e.target.closest?.("[data-gaze]");
      if (el) gazeAt(el);
    };
    const onOut = (e) => {
      const el = e.target.closest?.("[data-gaze]");
      if (el && !el.contains(e.relatedTarget)) live.gaze.active = false;
    };

    // wheel / keyboard scrolling moves the stage under a still pointer: re-test "inside"
    let lastX = -1;
    let lastY = -1;
    const track = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onScroll = () => {
      if (lastX < 0) return;
      const r = stage.getBoundingClientRect();
      const inside = lastX >= r.left && lastX <= r.right && lastY >= r.top && lastY <= r.bottom;
      live.pointer.inside = inside;
      if (live.pointer.fine) cursor.style.opacity = inside ? "1" : "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointermove", onDrag, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onOver);
    document.addEventListener("focusout", onOut);
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("contextmenu", noMenu);
    const unsub = useHero.subscribe((s) => {
      cursor.dataset.mode = s.ctaHover ? "cta" : s.bustHover ? "scan" : "";
    });
    // hold-to-charge progress arc around the cursor
    let lastCharge = -1;
    const chargeTick = () => {
      const c = Math.round((live.chargeLevel || 0) * 200) / 200;
      if (c === lastCharge) return;
      lastCharge = c;
      cursor.style.setProperty("--charge", String(c));
      cursor.classList.toggle("is-charging", c > 0.01);
    };
    gsap.ticker.add(chargeTick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onTilt);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onOver);
      document.removeEventListener("focusout", onOut);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("contextmenu", noMenu);
      gsap.ticker.remove(chargeTick);
      unsub();
    };
  }, []);

  const ctaOn = () => {
    const s = stageRef.current.getBoundingClientRect();
    const r = ctaRef.current.getBoundingClientRect();
    live.cta = {
      x: ((r.left + r.width / 2 - s.left) / s.width) * 2 - 1,
      y: -(((r.top + r.height / 2 - s.top) / s.height) * 2 - 1),
    };
    setHero({ ctaHover: true });
  };
  const ctaOff = () => setHero({ ctaHover: false });

  // ---- keep the canvas paused when the hero is off-screen
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);

  // ---- smooth scroll (figure hero only — title mode uses native scroll)
  useEffect(() => {
    if (reducedMotion || !SHOW_FIGURE) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    live.lenis = lenis;
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      live.lenis = null;
    };
  }, [reducedMotion]);

  // ---- smooth scroll pauses while the registration panel is open (the panel scrolls itself)
  const panel = useHero((s) => s.panel);
  useEffect(() => {
    if (panel) live.lenis?.stop();
    else live.lenis?.start();
    // touch scrolling is native (not Lenis): lock the page itself while the panel is up
    document.documentElement.classList.toggle("is-locked", !!panel);
  }, [panel]);

  // ---- returning visitor: greet them by name once the figure is awake
  const introDone = useHero((s) => s.introDone);
  const pass = useHero((s) => s.pass);
  useEffect(() => {
    const saved = loadPass();
    if (saved) setHero({ pass: saved });
  }, [setHero]);
  useEffect(() => {
    if (!introDone) return;
    const saved = useHero.getState().pass;
    if (!saved) return;
    const t = setTimeout(() => {
      live.glance = { x: 0, y: 0.1, until: performance.now() + 1800 }; // look at the visitor
      emit("nod");
      emit("ignite", { hold: 1.4 });
      const me = saved.passes[0];
      setHero({ toast: { text: `Welcome back, ${me.name.split(" ")[0]} · ${me.passId}`, at: Date.now() } });
    }, 500);
    return () => clearTimeout(t);
  }, [introDone, setHero]);

  // ---- easter egg: type the event's name anywhere
  useEffect(() => {
    let buf = "";
    const word = EVENT.name.toLowerCase();
    const onKey = (e) => {
      const el = e.target;
      if (el.closest?.("input,textarea,select,[contenteditable]") || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-word.length);
      if (buf !== word) return;
      buf = "";
      emit("ignite", { hold: 3 });
      emit("burst", { count: 260 });
      live.flash = 1.2;
      setHero({ toast: { text: "Access granted", at: Date.now() } });
    };
    const onEnter = (e) => {
      const el = e.target;
      if (e.key !== "Enter" || el.closest?.("input,textarea,select,[contenteditable],button")) return;
      if (useHero.getState().panel) return;
      e.preventDefault();
      window.location.href = EVENT.registerUrl;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onEnter);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onEnter);
    };
  }, [setHero]);

  // ---- intro: the figure is scanned into existence, the rim lights strike, the title rises
  useGSAP(
    () => {
      if (!ready) return;
      setRevealed(true);
      const done = () => setHero({ introDone: true });
      if (reducedMotion) {
        Object.assign(live.intro, { scan: 1, rim: 1, ignite: 0 });
        gsap.set("[data-loader]", { autoAlpha: 0 });
        gsap.set("[data-ui]", { autoAlpha: 1, y: 0 });
        gsap.set(".hero-hook", { clearProps: "opacity,visibility" });
        setGlitchPlay(true);
        done();
        return;
      }
      const first = !sessionStorage.getItem("enclave-intro");
      live.intro.scan = live.intro.rim = live.intro.ignite = 0;
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => {
          sessionStorage.setItem("enclave-intro", "1");
          done();
        },
      });
      if (!SHOW_FIGURE) {
        live.intro.scan = live.intro.rim = 1;
        // leave opacity to CSS arcade blink — don’t lock autoAlpha
        tl.to("[data-loader]", { autoAlpha: 0, duration: 0.45, ease: "power2.out" }, 0)
          .call(() => setGlitchPlay(true), null, 0.08)
          .set(".hero-hook", { clearProps: "opacity,visibility" }, 0.2);
      } else {
        tl.to("[data-loader]", { autoAlpha: 0, duration: 0.7, ease: "power2.out" }, 0)
          .to(live.intro, { scan: 1, duration: 2.1, ease: "power2.inOut" }, 0.2)
          .to(live.intro, { rim: 1, duration: 1.6, ease: "power2.inOut" }, 0.7)
          .fromTo(".hero-title .ch", { yPercent: 120 }, { yPercent: 0, duration: 1.5, stagger: byLetter(0.06) }, 0.5)
          .to(live.intro, { ignite: 1, duration: 0.22, ease: "power2.out" }, 1.85)
          .to(live.intro, { ignite: 0, duration: 1.2, ease: "power2.inOut" }, 2.15)
          .fromTo("[data-ui]", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.07 }, 1.6);
      }
      if (!first) tl.timeScale(1.9);
    },
    { dependencies: [ready, reducedMotion], scope: stageRef }
  );

  // ---- scroll: orbit to the poster angle, split the title, hand over to the next section
  useGSAP(
    () => {
      if (reducedMotion || !SHOW_FIGURE) return;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          onUpdate: (self) => {
            live.scroll = self.progress;
          },
        },
      });
      tl.to(".half-top", { yPercent: -16, ease: "power1.inOut", duration: 1 }, 0)
        .to(".half-bottom", { yPercent: 16, ease: "power1.inOut", duration: 1 }, 0)
        .to("[data-ui-scroll]", { autoAlpha: 0, y: -24, ease: "power1.in", duration: 0.28 }, 0)
        .to("[data-hint-end]", { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.3 }, 0.55);
    },
    { dependencies: [reducedMotion], scope: heroRef }
  );

  return (
    <section ref={heroRef} className={`hero${SHOW_FIGURE ? "" : " is-title"}`}>
      <div
        ref={stageRef}
        className={`hero-stage${SHOW_FIGURE && fine ? " has-cursor" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        <div className="hero-bg" />

        <div className="hero-title-wrap" data-parallax={!SHOW_FIGURE ? undefined : true}>
          {SHOW_FIGURE ? (
            <FigureTitle titleRef={titleRef} />
          ) : (
            <GlitchText
              as="h1"
              text={EVENT.name}
              mode="idle"
              play={glitchPlay}
              size={titleSize}
              className="hero-title hero-title-glitch"
            />
          )}
          <p className="hero-hook">Find the exit.</p>
        </div>

        {SHOW_FIGURE &&
          (webgl ? (
            <div className="hero-canvas">
              <HeroCanvas active={inView} />
            </div>
          ) : (
            // no WebGL: a still captured from the live scene keeps the poster composition
            <picture className="hero-still">
              <source media="(orientation: portrait)" srcSet="/enclave/hero/still-mobile.webp" />
              <img src="/enclave/hero/still-desktop.webp" alt="" className="h-full w-full object-cover" />
            </picture>
          ))}

        <div className="e-fx" aria-hidden="true">
          <div className="e-fx-scan" />
          <div className="e-fx-scan-v" />
          <div className="e-fx-grain" />
          <div className="e-fx-vignette" />
        </div>

        {SHOW_FIGURE ? (
          <div className="hero-ui" inert={!revealed}>
            <div data-ui-scroll className="absolute inset-0">
              <header className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
                <a href="/enclave" data-ui className="hero-logo flex items-center gap-3" aria-label={EVENT.club}>
                  <img src="/enclave/brand/neural-tech-logo-96.webp" alt="" width={30} height={32} className="h-8 w-auto" />
                  <span className="hidden text-[0.82rem] text-cream/80 sm:inline">{EVENT.club}</span>
                </a>
                <span data-ui className="mono-label hidden text-cream/55 md:inline">
                  {EVENT.institution} · {EVENT.department}
                </span>
                <a data-ui data-gaze href={EVENT.registerUrl} className="pill-ghost">
                  {pass ? "My pass" : "Register"}
                </a>
              </header>

              <div className="absolute bottom-0 left-0 px-5 pb-6 sm:px-8 sm:pb-9">
                <p data-ui className="mono-label mb-2 text-ember/70">
                  {EVENT.department} presents
                </p>
                <p
                  data-ui
                  className="hero-date font-display text-[clamp(3.4rem,8.5vw,7.5rem)] leading-[0.85] tracking-[0.04em] text-ember"
                >
                  {EVENT.date}
                </p>
                <div data-ui className="mt-3">
                  <Countdown />
                </div>
              </div>

              <div className="absolute bottom-0 right-0 flex flex-col items-end gap-3 px-5 pb-7 sm:px-8 sm:pb-10">
                <span data-ui className="mono-label hidden text-cream/45 sm:inline">
                  <span className="hint-fine">Move · click · hold the figure</span>
                  <span className="hint-coarse">Tap · hold the figure</span>
                </span>
                <div data-ui>
                  <a
                    ref={ctaRef}
                    href={EVENT.registerUrl}
                    className="cta"
                    onPointerEnter={ctaOn}
                    onPointerLeave={ctaOff}
                    onFocus={ctaOn}
                    onBlur={ctaOff}
                  >
                    {pass ? "View your pass" : "Press enter to start"}
                    <span className="cta-dot" />
                  </a>
                </div>
              </div>

              <div
                data-ui
                className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
              >
                <span className="mono-label text-cream/40">Scroll</span>
                <span className="scroll-cue-line" />
              </div>
            </div>

            <p
              data-hint-end
              className="mono-label invisible absolute bottom-10 left-1/2 -translate-x-1/2 translate-y-3 text-center text-cream/55 opacity-0"
            >
              {WHEN_WHERE}
            </p>
          </div>
        ) : null}

        <Toast />
        <Loader />
      </div>

      {SHOW_FIGURE ? (
        <div ref={cursorRef} className="hero-cursor" aria-hidden="true">
          <span className="hero-cursor-ring" />
          <span className="hero-cursor-dot" />
          <svg className="hero-cursor-charge" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
          </svg>
        </div>
      ) : null}
    </section>
  );
}
