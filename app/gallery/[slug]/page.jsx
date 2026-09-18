import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GlitchText from "../../tartarus/GlitchText";
import Seen from "../../tartarus/Seen";
import BootLine from "../BootLine";
import PhotoWall from "../PhotoWall";
import { events, getEvent, formatEventDate } from "../events";
import { readPhotos } from "../photos";

// No z-index on these sections: a stacking context here would trap the lightbox and
// the selection tray underneath the fixed header.
const block =
  "relative scroll-mt-[72px] px-5 py-16 sm:px-8 sm:py-20 md:px-[6vw] md:py-24 xl:mx-auto xl:max-w-[1440px] xl:px-16";

export function generateStaticParams() {
  return events.map((event) => ({ slug: event.slug }));
}

export const dynamicParams = false;

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

/** Glitches the text only for events whose theme asks for it; plain text otherwise. */
function Line({ as: Tag = "p", glitch, text, className = "", interval, ...rest }) {
  if (glitch) {
    return <GlitchText as={Tag} className={className} text={text} interval={interval} {...rest} />;
  }
  return (
    <Tag className={className} {...rest}>
      {text}
    </Tag>
  );
}

function EmptyWall() {
  return (
    <div className="g-empty mt-10">
      <p className="ev-label" style={{ color: "var(--ev-warn)" }}>
        No signal
      </p>
      <p className="ev-display mt-4 text-[clamp(1.7rem,5vw,2.8rem)]" style={{ color: "var(--ev-dim)" }}>
        00 files recovered
        <i className="g-caret" aria-hidden="true" />
      </p>
      <p className="mx-auto mt-5 max-w-[42ch] text-[1.02rem] leading-[1.6] text-[var(--ev-dim)]">
        The photos are still coming off the cameras. Come back — this wall fills up.
      </p>
    </div>
  );
}

export default async function EventGalleryPage({ params }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const photos = readPhotos(event.slug, event.title);
  const glitch = Boolean(event.theme.chrome?.glitch);
  const date = formatEventDate(event.date);

  return (
    <main className="relative min-h-[100svh] text-[var(--ev-ink)]">
      <header className="fixed inset-x-0 top-0 z-40 flex h-[58px] items-center justify-between gap-4 border-b border-[var(--ev-line)] bg-[var(--ev-bg)] px-5 md:px-[6vw] xl:px-16">
        <nav className="flex min-w-0 items-center gap-2.5" aria-label="Breadcrumb">
          <Link
            className="ev-label shrink-0 transition-colors hover:text-[var(--ev-accent)]"
            href="/gallery"
          >
            <span aria-hidden="true">← </span>Archive
          </Link>
          {/* the title is already huge in the hero, so phones drop it to make room */}
          <span className="ev-label hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="ev-display hidden truncate text-[1.2rem] sm:inline">{event.title}</span>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {event.briefingHref ? (
            <Link className="ev-cta ev-btn-sm" href={event.briefingHref}>
              Briefing
            </Link>
          ) : null}
          <Link className="ev-cta-ghost ev-btn-sm" href="/">
            Club site
          </Link>
        </div>
      </header>

      <section
        id="top"
        className="relative isolate flex min-h-[64svh] flex-col justify-center px-5 pt-[104px] pb-12 sm:px-8 md:px-[6vw] xl:mx-auto xl:max-w-[1440px] xl:px-16"
      >
        <p className="ev-label m-0 mb-5 flex items-center gap-2 text-[var(--ev-accent)]">
          <i className="ev-pulse" aria-hidden="true" />
          {glitch ? <BootLine label="Recovering files…" ready="Files online" /> : <span>Files online</span>}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {event.mark ? (
            <Image
              src={event.mark}
              alt={event.markAlt || ""}
              width={96}
              height={96}
              sizes="96px"
              priority
              className="h-[72px] w-[72px] border border-[var(--ev-line)] object-cover sm:h-24 sm:w-24"
              style={{ borderRadius: "var(--ev-radius)" }}
            />
          ) : null}
          <Line
            as="h1"
            glitch={glitch}
            className="ev-display text-[clamp(2.8rem,10vw,7rem)]"
            text={event.title}
            interval={2000}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="ev-chip" style={{ color: "var(--ev-accent)", borderColor: "var(--ev-accent)" }}>
            Complete
          </span>
          {date ? <span className="ev-label">{date}</span> : null}
          {event.kicker ? <span className="ev-label">{`// ${event.kicker}`}</span> : null}
          <span className="ev-label">{`${pad(photos.length)} photos`}</span>
        </div>

        {event.blurb ? (
          <Line
            as="p"
            glitch={glitch}
            className="m-0 mt-7 max-w-[58ch] text-[1.05rem] leading-[1.7] text-[var(--ev-dim)]"
            text={event.blurb}
            interval={3200}
          />
        ) : null}

        {event.stats?.length ? (
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {event.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="ev-label">{stat.label}</dt>
                <dd className="ev-display m-0 mt-1 text-[1.8rem]">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a className="ev-cta" href="#files">
            See the photos
          </a>
          {event.briefingHref ? (
            <Link className="ev-cta-ghost" href={event.briefingHref}>
              Read the briefing
            </Link>
          ) : null}
        </div>
      </section>

      <section id="files" className={`border-t border-[var(--ev-line)] ${block}`}>
        <Seen>
          <p className="ev-label">01 // files recovered</p>
          <Line
            as="h2"
            glitch={glitch}
            className="ev-display mt-4 text-[clamp(1.9rem,5.5vw,3.4rem)]"
            text="Take what you like."
            interval={2600}
          />
          <p className="mt-4 max-w-[48ch] text-[1rem] leading-[1.6] text-[var(--ev-dim)]">
            Every frame is downloadable. Mark the ones you want and grab them in one go.
          </p>
        </Seen>

        {photos.length ? (
          <PhotoWall
            event={{ slug: event.slug, title: event.title }}
            photos={photos}
            chrome={{ sweep: Boolean(event.theme.chrome?.sweep) }}
          />
        ) : (
          <EmptyWall />
        )}
      </section>

      <footer className="relative grid grid-cols-1 gap-4 border-t border-[var(--ev-line)] px-5 py-12 sm:px-8 md:grid-cols-3 md:items-center md:px-[6vw] md:py-14 xl:px-16">
        <Link className="ev-display text-[1.2rem]" href="/gallery">
          ← Archive
        </Link>
        <p className="ev-label m-0">{`Neural Tech // ${event.title} // ${pad(photos.length)} files`}</p>
        <Link className="ev-cta-ghost ev-btn-sm justify-self-start md:justify-self-end" href="/">
          Exit to club site
        </Link>
      </footer>
    </main>
  );
}
