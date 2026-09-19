import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import Reveal from "../components/Reveal";
import LineReveal from "../components/LineReveal";
import MarqueeHero from "./MarqueeHero";
import { events, formatEventDate } from "./events";
import { listPhotoFiles, readPhotos } from "./photos";
import { allFontClasses } from "./fonts";
import "./archive.css";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";
const display =
  "font-display text-[clamp(2.6rem,7.5vw,5.75rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]";

const title = "Archive — Neural Tech";
const description =
  "Every Neural Tech event we've run, with the photos. Browse an event's gallery and take whatever you like.";

export const metadata = {
  title,
  description,
  openGraph: { title, description, url: "/gallery" },
  twitter: { title, description },
};

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

export default function ArchiveHub() {
  const rows = events
    .map((event) => ({
      ...event,
      count: listPhotoFiles(event.slug).length,
    }))
    .filter((event) => event.count > 0);

  const photos = rows.flatMap((event) =>
    readPhotos(event.slug, event.title).map((photo) => ({
      src: photo.src,
      href: `/gallery/${event.slug}`,
      width: photo.width,
      height: photo.height,
    })),
  );

  return (
    <main className={`${allFontClasses} bg-cream text-soil`}>
      <SiteHeader />

      <section className="px-4 pt-[108px] pb-6 sm:px-6 sm:pt-[148px] sm:pb-10">
        <div className="mx-auto w-full max-w-[1040px]">
          <LineReveal as="h1" className={display} lines={["We keep", "the receipts."]} />
          <Reveal delay={2}>
            <p className="mt-5 max-w-[40ch] text-[0.95rem] leading-[1.65] text-soil/75">
              Every event we’ve run, with the photos that came out of it.
            </p>
          </Reveal>
        </div>
      </section>

      <MarqueeHero photos={photos} />

      <section className={`${wrap} pb-24 pt-6 sm:pb-32 sm:pt-8`}>
        <div className="ar-rows">
          {rows.map((event) => (
            <Link
              key={event.slug}
              href={`/gallery/${event.slug}`}
              className="ar-row ar-link"
              style={event.theme.tokens}
            >
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
                  {[formatEventDate(event.date), event.kicker, `${pad(event.count)} photos`]
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
            Photos from the room. Taken by whoever had a phone out.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-cream/15 pt-8 text-[0.88rem] sm:grid-cols-3">
            <Link className="transition-colors hover:text-blush" href="/">
              Back to the club site
            </Link>
            <Link className="transition-colors hover:text-blush" href="/tartarus">
              Tartarus briefing
            </Link>
            <span className="text-cream/45 sm:justify-self-end">© 2026 Neural Tech</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
