import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import Reveal from "../components/Reveal";
import LineReveal from "../components/LineReveal";
import { events, formatEventDate } from "../gallery/events";
import { listPhotoFiles } from "../gallery/photos";
import { allFontClasses } from "../gallery/fonts";
import "../gallery/archive.css";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const display =
  "font-display text-[clamp(2.6rem,7.5vw,5.75rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";

const title = "Events — Neural Tech";
const description = "Every event Neural Tech has run. Briefings, photos, whatever came out of the room.";

export const metadata = {
  title,
  description,
  openGraph: { title, description, url: "/events" },
  twitter: { title, description },
};

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function eventHref(event) {
  return event.briefingHref || `/gallery/${event.slug}`;
}

export default function EventsPage() {
  const rows = events.map((event) => ({
    ...event,
    count: listPhotoFiles(event.slug).length,
  }));

  return (
    <main className={`${allFontClasses} bg-cream text-soil`}>
      <SiteHeader />

      <section className="px-4 pt-[108px] pb-6 sm:px-6 sm:pt-[148px] sm:pb-10">
        <div className="mx-auto w-full max-w-[1040px]">
          <LineReveal as="h1" className={display} lines={["Days we", "actually ran."]} />
          <Reveal delay={2}>
            <p className="mt-5 max-w-[40ch] text-[0.95rem] leading-[1.65] text-soil/75">
              Every event the club has put on. Not a calendar of maybes — the ones that happened.
            </p>
          </Reveal>
        </div>
      </section>

      <section className={`${wrap} pb-24 pt-6 sm:pb-32 sm:pt-8`}>
        <div className="ar-rows">
          {rows.map((event) => (
            <Link key={event.slug} href={eventHref(event)} className="ar-row ar-link" style={event.theme.tokens}>
              <span className="ar-mark">
                {event.mark ? (
                  <Image src={event.mark} alt={event.markAlt || ""} width={58} height={58} sizes="58px" />
                ) : (
                  <span className="ar-wordmark">{event.title.slice(0, 2)}</span>
                )}
              </span>
              <span>
                <span className="ar-title">{event.title}</span>
                <span className="ar-meta">
                  {[formatEventDate(event.date), event.kicker, event.count ? `${pad(event.count)} photos` : null]
                    .filter(Boolean)
                    .join("  ·  ")}
                </span>
              </span>
              <span className="ar-go">
                View <i>→</i>
              </span>
            </Link>
          ))}

          <div className="ar-row ar-sealed">
            <span className="ar-mark" aria-hidden="true" />
            <span>
              <span className="ar-title">Classified</span>
              <span className="ar-meta">Next event pending · if we told you, it wouldn’t be a surprise</span>
            </span>
            <span className="ar-go">Sealed</span>
          </div>
        </div>
      </section>

      <footer className="cv-auto bg-soil text-cream">
        <div className={`${wrap} py-16 sm:py-20`}>
          <Link href="/" className="inline-block" aria-label="Neural Tech home">
            <Image
              src="/neural-tech-logo2.png"
              alt="Neural Techgenix Club"
              width={240}
              height={70}
              sizes="(max-width: 640px) 80vw, 240px"
              className="h-auto w-[min(100%,240px)]"
            />
          </Link>
          <p className="mt-4 m-0 max-w-[36ch] text-[0.88rem] leading-[1.5] text-cream/70">
            Built by students who got tired of waiting for someone else to build it.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-cream/15 pt-8 text-[0.88rem] sm:grid-cols-3">
            <Link className="transition-colors hover:text-blush" href="/">
              Back to the club site
            </Link>
            <Link className="transition-colors hover:text-blush" href="/gallery">
              Event archive
            </Link>
            <span className="text-cream/45 sm:justify-self-end">© 2026 Neural Tech</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
