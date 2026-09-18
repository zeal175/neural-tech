import { HalftoneFlow } from "@/components/ui/halftone-flow";
import Reveal from "./Reveal";
import LineReveal from "./LineReveal";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const spotlight =
  "font-display text-[clamp(2.4rem,5.85vw,5.25rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-cream/80 px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-cream hover:text-soil active:scale-[0.98]";

export default function UpcomingEvents() {
  return (
    <section id="events" className="cv-auto relative overflow-hidden bg-black py-28 text-cream sm:py-36 md:py-44">
      <HalftoneFlow className="absolute inset-0 h-full w-full" />

      <div className={`relative z-10 ${wrap} text-center`}>
        <Reveal>
          <p className="m-0 inline-flex items-center gap-2 rounded-full border border-cream/30 px-3.5 py-1 text-[0.7rem] font-normal uppercase tracking-[0.16em] text-cream/75">
            <span className="text-blush">●</span>
            Tartarus — run complete
          </p>
        </Reveal>

        <LineReveal className={`${spotlight} mt-5 text-cream`} lines={["One day.", "No safety net."]} />

        <Reveal delay={2}>
          <p className="mx-auto mt-5 max-w-[44ch] text-[0.92rem] leading-[1.6] text-cream/70">
            It wasn’t a hackathon. Four challenges, live eliminations, and a debug room that got meaner with every
            mistake. Teams talked their way past a sentry, named what the archive was hiding, and rebuilt four machines
            somebody broke on purpose. Talo’s watched. It didn’t go easy.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <a className={btnFill} href="/gallery/tartarus">
              See the photos
              <svg className="ml-1" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a className={btnGhost} href="/tartarus">
              Read the briefing
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
