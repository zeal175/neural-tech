import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import EventPhotos from "../EventPhotos";
import { events, getEvent } from "../events";
import { readPhotos } from "../photos";

const wrap = "mx-auto w-full max-w-[1040px] px-5 sm:px-6";

export function generateStaticParams() {
  return events.map((event) => ({ slug: event.slug }));
}

export const dynamicParams = false;

export default async function EventGalleryPage({ params }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const photos = readPhotos(event.slug, event.title);

  return (
    <main className="bg-cream text-soil">
      <SiteHeader />

      <h1 className="sr-only">{event.title} photos</h1>

      <section className="px-2.5 pt-[96px] pb-16 sm:px-5 sm:pt-[120px] sm:pb-32">
        <div className="mx-auto w-full max-w-[1320px]">
          <EventPhotos photos={photos} />
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
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-cream/15 pt-8 text-[0.88rem] sm:grid-cols-3">
            <Link className="transition-colors hover:text-blush" href="/gallery">
              Event archive
            </Link>
            {event.briefingHref ? (
              <Link className="transition-colors hover:text-blush" href={event.briefingHref}>
                {event.title} briefing
              </Link>
            ) : (
              <span />
            )}
            <span className="text-cream/45 sm:justify-self-end">© 2026 Neural Tech</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
