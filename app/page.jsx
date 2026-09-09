"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Code2,
  Menu,
  Radio,
  Users,
  X,
} from "lucide-react";

const events = [
  { date: "18 SEP", type: "WORKSHOP", title: "Build Your First Neural Network" },
  { date: "26 SEP", type: "TALK", title: "AI Beyond the Hype" },
  { date: "04 OCT", type: "HACK NIGHT", title: "Ship Something Strange" },
];

const steps = [
  ["01", "Show up", "Come curious. No experience, portfolio, or perfect idea required."],
  ["02", "Plug in", "Meet collaborators and learn through workshops, talks, and build nights."],
  ["03", "Make it real", "Turn strange ideas into prototypes, experiments, and shared knowledge."],
];

const pillars = [
  {
    icon: BrainCircuit,
    title: "Learn in public",
    copy: "Explore AI and emerging technology without the jargon or gatekeeping.",
  },
  {
    icon: Code2,
    title: "Build together",
    copy: "Find collaborators and turn half-formed ideas into things worth sharing.",
  },
  {
    icon: Users,
    title: "Find your people",
    copy: "Join a generous community of builders, artists, researchers, and curious minds.",
  },
];

function Mark() {
  return (
    <span className="flex h-[21px] w-6 -skew-x-[8deg] items-end gap-[3px]" aria-hidden="true">
      <i className="block h-[40%] w-1.5 bg-acid" />
      <i className="block h-[70%] w-1.5 bg-orange" />
      <i className="block h-full w-1.5 bg-coral" />
    </span>
  );
}

function Reveal({ children, className = "", delay = 0, as: Tag = "div", ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    const show = () => {
      frame = window.requestAnimationFrame(() => setVisible(true));
    };

    if (typeof IntersectionObserver === "undefined") {
      show();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            show();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: [0, 0.05, 0.1, 0.2],
        rootMargin: "0px 0px -5% 0px",
      },
    );

    observer.observe(node);

    // Catch elements already in view on mount/hydration
    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.95 && rect.bottom > 0;
    if (inView) show();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const delayMs = delay === 1 ? "delay-100" : delay === 2 ? "delay-200" : delay === 3 ? "delay-300" : "delay-0";

  return (
    <Tag
      ref={ref}
      {...props}
      className={[
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        delayMs,
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

const btnBase =
  "inline-flex min-h-[42px] items-center justify-center gap-2.5 border px-[17px] font-mono text-[0.65rem] font-bold uppercase tracking-[0.07em] transition-[transform,box-shadow,filter] duration-200 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[4px_4px_0_var(--color-coral)]";

const btnOutline = `${btnBase} border-paper text-paper`;
const btnPrimary = `${btnBase} border-[#070605] bg-acid text-[#070605]`;

const sectionPad = "px-6 py-[110px] md:px-[7vw] md:py-[150px] xl:mx-auto xl:max-w-[1680px] xl:px-14 xl:py-[170px]";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="bg-ink text-paper">
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-around px-[4.5vw] transition-[background,border-color,backdrop-filter,box-shadow] duration-300 ${
          scrolled
            ? "border-b border-white/[0.06] bg-ink/60 shadow-[0_1px_0_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[18px] backdrop-saturate-150"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <a className="flex items-center gap-2.5 font-mono text-[0.72rem] font-bold tracking-[0.14em]" href="#top" aria-label="Neural Tech home">
          <Mark />
          <span>NEURAL/TECH</span>
        </a>

        <nav
          className={`${
            menuOpen ? "flex" : "hidden"
          } absolute inset-x-0 top-[71px] flex-col gap-6 border-b border-line bg-ink px-6 py-7 md:static md:flex md:flex-row md:gap-8 md:border-0 md:bg-transparent md:p-0`}
          aria-label="Main navigation"
        >
          {[
            ["#about", "About"],
            // ["#events", "Events"],
            // ["#process", "How it works"],
            ["#community", "Community"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#b9bdb5] transition-colors hover:text-acid"
            >
              {label}
            </a>
          ))}
        </nav>

        <a className={`${btnOutline} hidden md:inline-flex`} href="#join">
          Join the network <ArrowRight size={15} />
        </a>
        <button
          className="border-0 bg-transparent p-0 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Hero — tweak image with w-* / bottom-* / left-* / translate-* breakpoints */}
      <section
        id="top"
        className="relative isolate flex min-h-[700px] h-screen items-start justify-center overflow-hidden bg-ink px-6 pt-[72px] md:min-h-[760px] md:px-[7vw] xl:mx-auto xl:max-w-[1680px]"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center animate-[hero-reveal_1.2s_ease_both]">
          <img
            src="/neural-tech-hero.png"
            alt=""
            aria-hidden="true"
            className="w-[92vw] max-w-none animate-[float-y_6s_ease-in-out_1.2s_infinite] contrast-[1.05] saturate-100 md:w-[min(88vw,1320px)] xl:w-[min(74vw,1460px)] 2xl:w-[min(88.8vw,1776px)]"
          />
        </div>

        <div className="absolute inset-x-0 top-[180px] z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 text-center md:top-[208px] xl:top-[220px] 2xl:top-[calc(147px+20vh)]">
          <h1 className="m-0 flex w-full flex-col items-center text-center font-sans font-black uppercase leading-[0.9] tracking-[-0.04em]">
            <span className="block w-full animate-[fade-up_0.7s_ease_both] whitespace-nowrap text-center text-[clamp(1.7rem,6.2vw,4.8rem)] 2xl:text-[clamp(2.04rem,7.44vw,5.76rem)]">
              NOT YOUR AVERAGE
            </span>
            <span className="mt-1 block w-full animate-[fade-up_0.7s_ease_0.12s_both] text-center font-display text-[clamp(1.8rem,5.8vw,5.4rem)] font-normal italic lowercase tracking-[-0.02em] text-acid 2xl:text-[clamp(2.16rem,6.96vw,6.48rem)]">
              tech club
            </span>
          </h1>
          <div className="mt-6 flex w-full animate-[fade-up_0.7s_ease_0.24s_both] flex-col items-center justify-center gap-4 sm:flex-row sm:gap-[22px]">
            <a className={`${btnPrimary} text-[0.7rem] font-semibold tracking-[0.04em] hover:brightness-105`} href="#join">
              Join Neural Tech <ArrowRight size={16} stroke="#070605" />
            </a>
            <a
              className="border-b border-current py-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] transition-colors hover:text-acid"
              href="#community"
            >
              See upcoming events
            </a>
          </div>
        </div>

        <p className="absolute bottom-[30px] right-[4vw] hidden animate-[fade-up_0.8s_ease_0.4s_both] font-mono text-[0.58rem] tracking-[0.15em] text-[#747b72] sm:block">
          12.9716° N / 77.5946° E
        </p>
      </section>

      <Reveal as="section" className="border-y border-line bg-panel-2 px-[7vw] py-12 text-center md:py-14" aria-label="Community disciplines">
        <p className="mb-6 font-mono text-[0.58rem] tracking-[0.18em] text-[#7e847b]">THE FREQUENCIES WE SHARE</p>
        <div className="grid grid-cols-1 md:grid-cols-5">
          {["ARTIFICIAL INTELLIGENCE", "CREATIVE CODE", "ROBOTICS", "DESIGN", "RESEARCH"].map((item) => (
            <span
              key={item}
              className="border-b border-line px-2.5 py-3 font-mono text-[0.65rem] font-bold tracking-[0.04em] text-[#b8bcb4] last:border-0 md:border-b-0 md:border-r md:last:border-0"
            >
              {item}
            </span>
          ))}
        </div>
      </Reveal>

      <section
        className={`relative flex min-h-[690px] flex-col items-center justify-center overflow-hidden bg-ink text-center text-paper ${sectionPad}`}
        id="about"
      >
        <Reveal>
          <h2 className="m-0 text-[3.3rem] font-black leading-[0.86] tracking-[-0.075em] md:text-[clamp(3.6rem,6.5vw,7.2rem)]">
            TECH MOVES FAST.
            <br />
            <em className="font-display font-normal lowercase text-acid italic">we move together.</em>
          </h2>
        </Reveal>
        <Reveal delay={1}>
          <p className="mx-auto mt-[34px] max-w-[690px] text-[1.05rem] leading-[1.8] text-muted">
            The future is being built in closed rooms, complicated threads, and lonely browser tabs. We think learning
            should be social, playful, and a little strange.
          </p>
        </Reveal>
        <Reveal delay={2} className="mt-8 flex w-[min(590px,70vw)] flex-col items-center gap-[7px]" aria-hidden="true">
          <i className="block h-[3px] w-full bg-[#343a34]" />
          <i className="block h-[3px] w-[88%] bg-[#343a34]" />
          <i className="block h-[3px] w-[72%] bg-[#343a34]" />
          <i className="block h-[3px] w-1/2 bg-coral" />
        </Reveal>
      </section>

      {/* Temporarily hidden: Enter the network */}
      {false && (
        <section className={`bg-panel text-paper ${sectionPad}`} id="process">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
            <h2 className="m-0 text-[3.3rem] font-black leading-[0.86] tracking-[-0.075em] md:text-[clamp(3.6rem,6.5vw,7.2rem)]">
              ENTER THE
              <br />
              <em className="font-display font-normal lowercase text-acid italic">network.</em>
            </h2>
            <p className="mb-2 max-w-[440px] leading-[1.7] text-muted">
              Neural Tech turns passive interest into shared momentum. Start wherever you are—we’ll build from there.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-7 md:grid-cols-2">
            <div className="min-h-[390px] border border-line bg-[#0b100e] shadow-[inset_0_0_50px_rgba(217,255,56,0.03)]">
              <div className="flex h-[42px] items-center gap-[7px] border-b border-line px-[15px]">
                <span className="h-[7px] w-[7px] rounded-full bg-coral" />
                <span className="h-[7px] w-[7px] rounded-full bg-orange" />
                <span className="h-[7px] w-[7px] rounded-full bg-acid" />
                <b className="ml-auto font-mono text-[0.55rem] font-normal text-[#656c63]">NEURAL_TERMINAL.exe</b>
              </div>
              <div className="flex min-h-[348px] flex-col items-center justify-center text-acid">
                <BrainCircuit size={110} strokeWidth={0.8} className="drop-shadow-[0_0_18px_rgba(217,255,56,0.25)]" />
                <p className="mt-[30px] font-mono text-[0.62rem] leading-[1.8] text-[#75806f]">
                  &gt; CONNECTION_ESTABLISHED
                  <br />
                  &gt; ACCESS_LEVEL: CURIOUS
                </p>
              </div>
            </div>

            <div className="border-t border-line">
              {steps.map(([number, title, copy], index) => (
                <article
                  key={number}
                  className={`grid min-h-[130px] grid-cols-[42px_1fr_28px] items-center gap-3.5 border-b border-line px-[18px] py-6 transition-colors ${
                    index === 1 ? "bg-orange/[0.06] outline outline-1 outline-offset-[-1px] outline-orange" : "hover:bg-orange/[0.06]"
                  }`}
                >
                  <span className="self-start font-mono text-[0.6rem] text-[#6b7269]">{number}</span>
                  <div>
                    <h3 className="mb-2 text-[1.1rem] uppercase">{title}</h3>
                    <p className="m-0 max-w-[430px] text-[0.85rem] leading-[1.55] text-muted">{copy}</p>
                  </div>
                  <ArrowRight className="w-[17px] text-orange" />
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Temporarily hidden: Up next */}
      {false && (
        <section className={`bg-ink text-paper ${sectionPad}`} id="events">
          <div className="mb-12 flex flex-col items-start justify-between gap-7 md:flex-row md:items-end">
            <h2 className="m-0 text-[clamp(4rem,7vw,7.5rem)] font-black leading-[0.86] tracking-[-0.075em]">
              UP NEXT<span className="text-coral">.</span>
            </h2>
            <a className="border-b border-current py-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em]" href="#join">
              View all events
            </a>
          </div>
          <div className="border-t border-line">
            {events.map((event) => (
              <article
                key={event.title}
                className="grid min-h-[135px] grid-cols-[72px_1fr_42px] items-center gap-2 border-b border-line py-[22px] transition-[background,padding,color] hover:bg-acid hover:px-3.5 hover:text-ink md:grid-cols-[110px_130px_1fr_55px] md:gap-0 md:py-0"
              >
                <p className="font-mono text-[0.63rem] tracking-[0.07em]">{event.date}</p>
                <span className="hidden font-mono text-[0.63rem] tracking-[0.07em] text-[#8a9086] md:inline">{event.type}</span>
                <h3 className="m-0 text-[0.95rem] uppercase md:text-[clamp(1.1rem,2vw,1.55rem)]">{event.title}</h3>
                <a
                  className="grid h-[42px] w-[42px] place-items-center justify-self-end border border-current"
                  href="#join"
                  aria-label={`View ${event.title}`}
                >
                  <ArrowRight />
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={`bg-panel-2 text-paper ${sectionPad}`} id="community">
        <Reveal>
          <h2 className="m-0 max-w-[1050px] text-[3.3rem] font-black leading-[0.86] tracking-[-0.075em] md:text-[clamp(3.6rem,6.5vw,7.2rem)]">
            BUILT FOR A DIFFERENT
            <br />
            KIND OF <em className="font-display font-normal lowercase text-acid italic">club.</em>
          </h2>
        </Reveal>
        <div className="mt-[50px] grid grid-cols-1 border-t border-line md:mt-20 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, copy }, index) => (
            <Reveal
              key={title}
              delay={index + 1}
              as="article"
              className={`min-h-0 border-b border-line py-[35px] md:min-h-[330px] md:border-b-0 md:border-r md:py-[30px] md:pr-10 md:last:border-0 ${
                index > 0 ? "md:pl-10" : ""
              }`}
            >
              <span className="font-mono text-[0.6rem] text-[#676e65]">0{index + 1}</span>
              <Icon className="my-[22px] block h-[38px] w-[38px] stroke-[1.2] text-orange md:my-[50px]" />
              <h3 className="mb-[15px] uppercase">{title}</h3>
              <p className="m-0 max-w-[320px] text-[0.9rem] leading-[1.65] text-muted">{copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Join — tweak image with right-* / bottom-* / w-* / translate-* breakpoints */}
      <section
        id="join"
        className="relative min-h-[620px] overflow-hidden border-y border-line bg-transparent px-8 py-[130px] text-paper md:px-[8vw] md:py-[180px] xl:mx-auto xl:max-w-[1680px] xl:px-20 xl:py-[200px]"
      >
        <img
          src="/neural-tech-footer.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-[-40px] z-0 w-[min(100%,900px)] max-w-none md:right-[-100px] md:w-[min(100%,1200px)] xl:right-[-170px] xl:w-[min(100%,1400px)] 2xl:bottom-[60px]"
        />

        <Reveal className="relative z-10 max-w-[720px]">
          <p className="mb-9 flex w-max items-center gap-2 font-mono text-[0.64rem] font-medium uppercase tracking-[0.12em] text-[#c0c5bb]">
            <Radio size={13} className="text-acid" /> Open channel
          </p>
          <h2 className="relative z-10 m-0 text-[3.3rem] font-black leading-[0.86] tracking-[-0.075em] md:text-[clamp(3.6rem,6.5vw,7.2rem)]">
            COME BUILD THE
            <br />
            <em className="font-display font-normal lowercase text-acid italic">future with us.</em>
          </h2>
          <p className="my-[30px] text-muted">Bring your questions. Bring your weird idea. Bring a friend.</p>
          <a className={`${btnPrimary} min-h-[51px]`} href="mailto:hello@neuraltech.club">
            Request access <ArrowRight size={17} stroke="#070605" />
          </a>
        </Reveal>
      </section>

      <footer className="relative grid min-h-40 grid-cols-1 items-center gap-6 overflow-hidden bg-transparent px-6 py-[55px] font-mono text-[0.58rem] tracking-[0.1em] text-[#858b82] md:grid-cols-2 md:px-[7vw] md:py-10 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <a className="flex items-center gap-2.5 font-mono text-[0.72rem] font-bold tracking-[0.14em] text-paper" href="#top">
          <Mark />
          <span>NEURAL/TECH</span>
        </a>
        <p>HUMANS BUILDING WITH MACHINES.</p>
        <div className="flex gap-[22px]">
          <a className="hover:text-acid" href="mailto:hello@neuraltech.club">
            EMAIL
          </a>
          <a className="hover:text-acid" href="#">
            INSTAGRAM
          </a>
          <a className="hover:text-acid" href="#">
            DISCORD
          </a>
        </div>
        <span>© 2026 NT</span>
      </footer>
    </main>
  );
}
