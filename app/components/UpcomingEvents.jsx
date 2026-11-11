import { HalftoneFlow } from "@/components/ui/halftone-flow";
import Reveal from "./Reveal";
import LineReveal from "./LineReveal";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const spotlight =
  "font-display text-[clamp(2.4rem,5.85vw,5.25rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";

export default function UpcomingEvents() {
  return (
    <section id="events" className="cv-auto relative overflow-hidden bg-black py-28 text-cream sm:py-36 md:py-44">
      <HalftoneFlow className="absolute inset-0 h-full w-full" />

      <div className={`relative z-10 ${wrap} text-center`}>
        <LineReveal className={`${spotlight} text-cream`} lines={["Oracle", "is postponed."]} />

        <Reveal delay={2}>
          <p className="mx-auto mt-5 max-w-[38ch] text-[0.92rem] leading-[1.6] text-cream/70">
            We’re deeply sorry — it has been moved to a later date due to unforeseeable reasons.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
