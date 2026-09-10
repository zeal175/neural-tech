import Reveal from "./Reveal";
import LineReveal from "./LineReveal";

const upcoming = [
  {
    name: "Talos Gate",
    type: "Layer 01",
    copy: "Talk past the sentry. Extract four fragments. Do not ask for the key.",
    href: "/tartarus#gate",
  },
  {
    name: "Memory Vault",
    type: "Layer 02",
    copy: "Name the concept. Derive a heat-specific code. Copied codes will not clear.",
    href: "/tartarus#vault",
  },
  {
    name: "Neural Triage",
    type: "Layer 03",
    copy: "Diagnose, isolate, repair. Sensors lie. Guessing costs shots.",
    href: "/tartarus#triage",
  },
  {
    name: "Core",
    type: "Layer 04",
    copy: "You strike. Probe, inject, challenge, override. Empty reasons bounce.",
    href: "/tartarus#core",
  },
];

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const spotlight =
  "font-display text-[clamp(2.4rem,5.85vw,5.25rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";

export default function UpcomingEvents() {
  return (
    <section id="events" className="cv-auto relative overflow-hidden bg-soil py-20 text-cream sm:py-24 md:py-28">
      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-blush/35 blur-3xl sm:h-[300px] sm:w-[300px]" />
      <div className="pointer-events-none absolute left-[18%] top-[28%] h-[160px] w-[160px] rounded-full bg-navy/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[16%] top-[22%] h-[180px] w-[180px] rounded-full bg-[#e8c9a8]/40 blur-3xl" />

      <div className={`relative z-10 ${wrap} text-center`}>
        <p className="mb-5 text-[0.68rem] font-normal uppercase tracking-[0.12em] text-blush">
          <span className="mr-2">●</span>Open channel
        </p>
        <LineReveal className={`${spotlight} text-cream`} lines={["One day.", "No safety net."]} />
        <Reveal delay={2}>
          <p className="mx-auto mt-5 max-w-[42ch] text-[0.92rem] leading-[1.6] text-cream/70">
            Tartarus isn’t a hackathon. It’s a full day of AI-themed events, live eliminations, and a debug room that
            gets meaner with every mistake. No entry fee. Real cash prize. Talo’s is watching, and it doesn’t go easy.
          </p>
          <a className={`${btnFill} mt-6`} href="/tartarus">
            See Tartarus
            <svg className="ml-1" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>
      </div>

      <div className={`relative z-10 ${wrap} mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2`}>
        {upcoming.map((event, index) => (
          <Reveal
            key={event.name}
            delay={(index % 2) + 1}
            variant="card"
            as="a"
            href={event.href}
            className="rounded-2xl bg-white/70 p-5 text-soil backdrop-blur-[2px] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span className="text-[0.68rem] font-normal uppercase tracking-[0.12em] text-blush">{event.type}</span>
            <h3 className="mt-3 mb-2 font-sans text-[1.2rem] font-normal tracking-[-0.03em]">{event.name}</h3>
            <p className="m-0 max-w-[36ch] text-[0.88rem] leading-[1.55] text-soil/70">{event.copy}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
