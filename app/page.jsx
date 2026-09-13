import Image from "next/image";
import dynamic from "next/dynamic";
import { HalftoneFlow } from "@/components/ui/halftone-flow";
import Reveal from "./components/Reveal";
import LineReveal from "./components/LineReveal";
import SiteHeader from "./components/SiteHeader";
import UpcomingEvents from "./components/UpcomingEvents";

const ClubSleepMarquee = dynamic(() => import("./components/ClubSleepMarquee"), {
  loading: () => <div className="h-[280px] w-[280px] md:h-[600px] md:w-[600px]" aria-hidden />,
});

const frequencies = [
  "Artificial Intelligence",
  "Creative Code",
  "Robotics",
  "Design",
  "Research",
  "Chaos",
];

const clubStats = [
  {
    badge: "01",
    n: "01",
    label: "Learn out loud",
    note: "No gatekeeping, no “you should already know this.” Ask the dumb question. Someone here already asked dumber.",
    spark: "M0 34 C18 30 28 22 46 24 C68 26 82 12 120 8 L120 40 L0 40 Z",
    fill: "#f2765e",
  },
  {
    badge: "02",
    n: "02",
    label: "Build on purpose",
    note: "Half-finished ideas welcome. We’d rather you ship something broken than perfect something invisible.",
    spark: "M0 28 C22 26 34 18 52 14 C78 8 92 16 120 4 L120 40 L0 40 Z",
    fill: "#315b8c",
  },
  {
    badge: "03",
    n: "03",
    label: "Stay weird",
    note: "Every club promises community. We promise you’ll leave a meeting with either a new idea or a new inside joke. Usually both.",
    spark: "M0 30 C24 32 40 20 58 22 C84 24 96 10 120 12 L120 40 L0 40 Z",
    fill: "#e8c9a8",
  },
];

function Spark({ d, fill }) {
  return (
    <svg viewBox="0 0 120 40" className="h-8 w-[4.5rem]" aria-hidden="true">
      <path d={d} fill={fill} />
    </svg>
  );
}

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const pad = "py-28 sm:py-36 md:py-44";
const display =
  "font-display text-[clamp(2.15rem,5.15vw,4.625rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";
const spotlight =
  "font-display text-[clamp(2.4rem,5.85vw,5.25rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";
const heroDisplay =
  "font-display text-[clamp(3.25rem,10vw,9rem)] font-bold uppercase leading-[0.88] tracking-[0.02em]";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-cream/80 px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-cream hover:text-soil active:scale-[0.98]";
const btnDark =
  "inline-flex items-center justify-center rounded-full bg-soil px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-navy active:scale-[0.98]";

export default function Home() {
  return (
    <main className="bg-cream text-soil">
      <SiteHeader />

      <section id="top" className="relative isolate flex min-h-[100svh] items-start justify-center overflow-hidden bg-black">
        <Reveal variant="hero" className="absolute inset-0 overflow-hidden">
          <HalftoneFlow className="absolute inset-0 h-full w-full" />
        </Reveal>
        <div className="relative z-10 mx-auto mt-[30vh] flex w-full max-w-[1280px] flex-col items-center px-5 text-center">
          <LineReveal
            as="h1"
            className={`${heroDisplay} text-cream`}
            lines={[
              <span className="whitespace-nowrap">Not your average</span>,
              <span className="whitespace-nowrap">tech club</span>,
            ]}
          />
          <Reveal delay={2}>
            <p className="mt-5 max-w-[32ch] text-[0.9rem] font-normal leading-[1.5] text-cream/85">
              A room for AI, code, and people who actually show up.
            </p>
          </Reveal>
          <Reveal delay={3} className="mt-6 flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
            <a className={btnFill} href="#join">
              Join Neural Tech
            </a>
            <a className={btnGhost} href="#events">
              See Tartarus
            </a>
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden border-y border-soil/10 bg-cream py-6 sm:py-7" aria-label="Community disciplines">
        <div className="nt-marquee-track flex gap-10 px-6 font-sans text-[1.05rem] font-normal uppercase tracking-[-0.02em] text-soil/55 sm:text-[1.15rem]">
          {[...frequencies, ...frequencies].map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-12 whitespace-nowrap">
              {item}
              <span className="text-blush">●</span>
            </span>
          ))}
        </div>
      </section>

      <section id="about" className={`cv-auto bg-cream ${pad}`}>
        <div className={`${wrap} grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-12`}>
          <LineReveal className={display} lines={["Tech moves fast.", "Then it stopped", "being social."]} />
          <Reveal delay={1} className="md:pt-2">
            <p className="m-0 max-w-[38ch] text-[0.95rem] leading-[1.65] text-soil/75">
              The future is being built in closed rooms, complicated threads, and lonely browser tabs. We think
              learning should be social, playful, and a little strange. Show up curious. No portfolio required.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="cv-auto bg-blush text-soil">
        <div className={`${wrap} pt-24 pb-16 sm:pt-32 sm:pb-20 md:pt-40 md:pb-24`}>
          <LineReveal className={display} lines={["Built for people", "who show up", "twice."]} />
        </div>
      </section>

      <div className="relative">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="h-1/2 bg-blush" />
          <div className="h-1/2 bg-cream" />
        </div>
        <div className={`relative ${wrap} py-8 sm:py-10 md:py-12`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {clubStats.map((stat, index) => (
              <Reveal
                key={stat.badge}
                delay={index + 1}
                variant="card"
                as="article"
                className="rounded-2xl bg-white p-4 text-soil shadow-[0_8px_28px_rgba(65,51,51,0.08)] sm:p-5"
              >
                <div className="flex items-center gap-2">
                  <Image src="/neural-tech-logo1.png" alt="" width={20} height={20} sizes="20px" className="h-5 w-5 object-contain" />
                  <span className="rounded-full bg-soil px-2 py-0.5 text-[0.58rem] font-normal uppercase tracking-[0.08em] text-cream">
                    {stat.badge}
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[2.15rem] font-bold leading-none tracking-[0.02em] sm:text-[2.4rem]">
                      {stat.n}
                    </p>
                    <p className="mt-2 font-sans text-[1.2rem] font-normal tracking-[-0.03em] uppercase">{stat.label}</p>
                  </div>
                  <Spark d={stat.spark} fill={stat.fill} />
                </div>
                <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[0.75rem] leading-[1.45] text-soil/70">{stat.note}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <section id="community" className="relative overflow-x-clip bg-cream">
        <div className="relative min-h-[620px] w-full md:min-h-[800px]">
          <div className="pointer-events-auto absolute inset-0 z-0 flex items-center justify-center">
            <ClubSleepMarquee />
          </div>
          <div className="pointer-events-none relative z-10 mx-auto grid min-h-[620px] max-w-[1240px] grid-cols-2 grid-rows-[auto_1fr_auto] px-5 py-24 sm:px-8 md:min-h-[800px] md:px-10 md:py-32">
            <LineReveal className={`${spotlight} col-start-1 row-start-1`} lines={["A club"]} />
            <LineReveal
              className={`${spotlight} col-start-2 row-start-3 justify-self-end text-right`}
              delay={80}
              lines={["Never sleeps"]}
            />
          </div>
        </div>
        <div className={`${wrap} pt-16 pb-28 sm:pt-20 sm:pb-36 md:pt-24 md:pb-44`}>
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-12">
            <LineReveal className={display} lines={["Not a Discord", "server that died", "in week two."]} />
            <Reveal delay={1} className="md:pt-2">
              <p className="m-0 max-w-[38ch] text-[0.95rem] leading-[1.65] text-soil/75">
                Most club “communities” are a group chat nobody opens after the first event. Ours actually gets used —
                for late-night debugging, dumb memes, project check-ins, and the occasional 2am “does anyone know why
                this won’t compile.”
              </p>
              <p className="mt-4 m-0 max-w-[38ch] text-[0.88rem] leading-[1.6] text-soil/70">
                Bring your questions. Bring your weird idea. Bring a friend.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <UpcomingEvents />

      <section className={`cv-auto bg-cream ${pad}`}>
        <div className={`${wrap} grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-12`}>
          <LineReveal className={display} lines={["We’re the club", "that asked", "“Why not?”"]} />
          <Reveal delay={1} className="md:pt-2">
            <p className="m-0 max-w-[38ch] text-[0.95rem] leading-[1.65] text-soil/75">
              Neural Techgenix started because every other club on campus looked the same — same posters, same monthly
              guest lecture, same silence in between. We built the first club website on campus because we don’t wait
              for permission to do things differently. If that sounds like your kind of chaos, you’re in the right
              place.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="join" className={`cv-auto bg-blush text-center text-soil ${pad}`}>
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-6">
          <LineReveal as="h2" className={`${heroDisplay} mx-auto`} lines={["We promise", "nothing normal."]} />
          <Reveal delay={2}>
            <p className="mx-auto mt-5 max-w-[38ch] text-[0.95rem] leading-[1.65] text-soil/80">
              Not another guest-lecture club. Not another dead group chat. Come find out what we actually are.
            </p>
            <a className={`${btnDark} mt-8 inline-flex`} href="mailto:hello@neuraltech.club">
              Join the club
              <svg className="ml-1" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="cv-auto bg-soil text-cream">
        <div className={`${wrap} py-16 sm:py-20 md:py-24`}>
          <a href="#top" className="inline-block" aria-label="Neural Tech home">
            <Image
              src="/neural-tech-logo2.png"
              alt="Neural Techgenix Club"
              width={280}
              height={80}
              sizes="(max-width: 640px) 90vw, 280px"
              className="h-auto w-[min(100%,280px)]"
            />
          </a>
          <p className="mt-4 m-0 max-w-[36ch] text-[0.88rem] leading-[1.5] text-cream/70">
            Built by students who got tired of waiting for someone else to build it.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-cream/15 pt-8 text-[0.88rem] sm:grid-cols-3">
            <p className="m-0 max-w-[28ch] text-cream/70">Humans building with machines. Bangalore.</p>
            <div className="flex flex-col gap-2">
              <a className="transition-colors hover:text-blush" href="mailto:hello@neuraltech.club">
                Email
              </a>
              <a className="transition-colors hover:text-blush" href="#">
                Instagram
              </a>
              <a className="transition-colors hover:text-blush" href="#">
                Discord
              </a>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <a className="transition-colors hover:text-blush" href="/tartarus">
                Tartarus briefing
              </a>
              <span className="text-cream/45">© 2026 Neural Tech</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
