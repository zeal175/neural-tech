import Image from "next/image";
import Link from "next/link";
import { HalftoneFlow } from "@/components/ui/halftone-flow";
import SiteHeader from "../components/SiteHeader";
import Reveal from "../components/Reveal";
import LineReveal from "../components/LineReveal";
import { events, formatEventDate } from "../gallery/events";
import { listPhotoFiles } from "../gallery/photos";
import { allFontClasses } from "../gallery/fonts";
import "./events.css";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const heroDisplay =
  "font-display text-[clamp(3.25rem,10vw,9rem)] font-bold uppercase leading-[0.88] tracking-[0.02em]";
const sealedDisplay =
  "font-display text-[clamp(2.8rem,8vw,7rem)] font-bold uppercase leading-[0.88] tracking-[0.02em]";
const btnFill =
  "inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-[0.84rem] font-normal text-soil transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.98]";

const title = "Events — Neural Tech";
const description =
  "Tartarus is a live AI competition — not a hackathon, not a workshop. One day inside a hostile system.";

export const metadata = {
  title,
  description,
  openGraph: { title, description, url: "/events" },
  twitter: { title, description },
};

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function ticketCells(event) {
  return [
    ["Date", formatEventDate(event.date)],
    ["Time", event.time],
    ["Venue", event.venue],
  ].filter(([, value]) => value);
}

export default function EventsPage() {
  return (
    <main className={`${allFontClasses} bg-cream text-soil`}>
      <SiteHeader />

      <section
        id="top"
        className="relative isolate flex min-h-[100svh] items-start justify-center overflow-hidden bg-black"
      >
        <Reveal variant="hero" className="absolute inset-0 overflow-hidden">
          <HalftoneFlow className="absolute inset-0 h-full w-full" />
        </Reveal>
        <div className="relative z-10 mx-auto mt-[30vh] flex w-full max-w-[1280px] flex-col items-center px-5 text-center">
          <LineReveal
            as="h1"
            className={`${heroDisplay} text-cream`}
            lines={[
              <span className="whitespace-nowrap">Here’s the</span>,
              <span className="whitespace-nowrap">record.</span>,
            ]}
          />
          <Reveal delay={2} className="w-full min-w-0">
            <p className="mx-auto mt-5 max-w-[28ch] px-1 text-[0.9rem] font-normal leading-[1.5] text-cream/85 sm:max-w-[34ch]">
              Live rooms. Shared clocks. No take-home brief. One day so far.
            </p>
          </Reveal>
          <Reveal delay={3} className="mt-6">
            <a className={btnFill} href="#tartarus">
              Tartarus
              <svg className="ml-1" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      {events.map((event, index) => {
        const cells = ticketCells(event);
        const galleryHref = listPhotoFiles(event.slug).length ? `/gallery/${event.slug}` : null;

        return (
          <article
            key={event.slug}
            id={event.slug}
            className="ev-band"
            style={event.theme.tokens}
          >
            <div className="ev-band-inner">
              {event.cover ? (
                <figure className="ev-cover">
                  <Image
                    src={event.cover}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 92vw, 46vw"
                    quality={75}
                    priority={index === 0}
                    className="object-cover"
                  />
                </figure>
              ) : null}

              <div className="ev-copy">
                <div className="ev-head">
                  {event.kicker ? <p className="ev-kicker">{event.kicker}</p> : null}

                  <LineReveal as="h2" className="ev-title" lines={[event.title]} />
                </div>

                <div className="ev-body">
                  {event.blurb ? (
                    <Reveal delay={2}>
                      <p className="ev-blurb">{event.blurb}</p>
                    </Reveal>
                  ) : null}

                  {event.beats?.length ? (
                    <Reveal delay={3}>
                      <ol className="ev-beats">
                        {event.beats.map((beat, beatIndex) => (
                          <li key={beat}>
                            <b>{pad(beatIndex + 1)}</b>
                            <span>{beat}</span>
                          </li>
                        ))}
                      </ol>
                    </Reveal>
                  ) : null}

                  {cells.length ? (
                    <Reveal delay={3}>
                      <p className="ev-place">
                        {cells.map(([, value], i) => (
                          <span key={value}>
                            {i > 0 ? <span className="ev-place-dot" aria-hidden="true">●</span> : null}
                            {value}
                          </span>
                        ))}
                      </p>
                    </Reveal>
                  ) : null}

                  {galleryHref ? (
                    <Reveal delay={4}>
                      <Link className="ev-btn" href={galleryHref}>
                        See the photos
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M5 12h14M13 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Link>
                    </Reveal>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        );
      })}

      <section className="ev-sealed">
        <div className="ev-sealed-inner">
          <LineReveal as="h2" className={sealedDisplay} lines={["If we told you."]} />
          <Reveal delay={2}>
            <p>It wouldn’t be a surprise. Next one stays sealed. Show up anyway.</p>
          </Reveal>
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
            <span className="text-cream/45 sm:justify-self-end sm:col-start-3">© 2026 Neural Tech</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
