import { HalftoneFlow } from "@/components/ui/halftone-flow";
import Reveal from "./Reveal";
import LineReveal from "./LineReveal";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const spotlight =
  "font-display text-[clamp(2.4rem,5.85vw,5.25rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";

export default function UpcomingEvents() {
  return (
    <section id="events" className="cv-auto relative overflow-hidden bg-black py-28 text-cream sm:py-36 md:py-44">
      <HalftoneFlow className="absolute inset-0 h-full w-full" />

      <div className={`relative z-10 ${wrap} text-center`}>
        <LineReveal className={`${spotlight} text-cream`} lines={["Days we", "actually ran."]} />

        <Reveal delay={2}>
          <p className="mx-auto mt-5 max-w-[38ch] text-[0.92rem] leading-[1.6] text-cream/70">
            Every event the club has put on. Not a calendar of maybes — the ones that happened.
          </p>
          <a className={`${btnFill} mt-7`} href="/events">
            See the events
            <svg className="ml-1" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
