import Image from "next/image";
import { HalftoneFlow } from "@/components/ui/halftone-flow";
import SiteHeader from "../components/SiteHeader";
import ClubRegister from "../components/ClubRegister";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const pad = "py-28 sm:py-36 md:py-44";

export const metadata = {
  title: "Join the club — Neural Tech",
  description: "Register for Neural Tech. Show up curious. No portfolio required.",
};

export default function JoinPage() {
  return (
    <main id="top" className="relative isolate min-h-[100svh] bg-black text-cream">
      <div className="pointer-events-none fixed inset-0 z-0">
        <HalftoneFlow className="h-full w-full" />
      </div>

      <SiteHeader />

      <section className={`relative z-10 ${pad} pt-32 sm:pt-36 md:pt-40`}>
        <div className={wrap}>
          <ClubRegister />
        </div>
      </section>

      <footer className="relative z-10 bg-soil text-cream">
        <div className={`${wrap} py-16 sm:py-20 md:py-24`}>
          <a href="/" className="inline-block" aria-label="Neural Tech home">
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
