import LineReveal from "./LineReveal";
import { WHATSAPP_URL } from "@/lib/club-contact";

const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";
const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-cream/80 px-5 py-2.5 text-[0.84rem] font-normal text-cream transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-cream hover:text-soil active:scale-[0.98]";
const display =
  "font-display text-[clamp(2.15rem,5.15vw,4.625rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";

export default function ClubRegister() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <LineReveal as="h1" className={`${display} text-cream`} lines={["We’ve closed", "registrations."]} />
      <p className="mx-auto mt-6 max-w-[34ch] text-[0.95rem] leading-[1.65] text-cream/75">
        If you’re interested, contact us personally.
      </p>
      <div className="mt-8 flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
        <a className={btnFill} href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          WhatsApp us
        </a>
        <a className={btnGhost} href="/">
          Back home
        </a>
      </div>
    </div>
  );
}
