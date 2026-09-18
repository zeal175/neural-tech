import { notFound } from "next/navigation";
import { getEvent } from "../events";
import { themeFontClass } from "../fonts";
// tartarus.css first so gallery.css wins where they overlap. It carries the glitch
// keyframes and the scanline/noise overlays that CRT-chrome events opt into.
import "../../tartarus/tartarus.css";
import "../gallery.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return { title: "Archive — Neural Tech" };

  const title = `${event.title} — photos — Neural Tech`;
  const description =
    event.blurb || `Photos from ${event.title}, a Neural Tech event. Take whatever you like.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `/gallery/${event.slug}` },
    twitter: { title, description },
  };
}

export default async function EventGalleryLayout({ children, params }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const { theme } = event;
  const crt = theme.name === "crt";

  return (
    <div
      className={`ev ${themeFontClass(theme.font)} ${crt ? "tartarus" : ""}`}
      data-ev-theme={theme.name}
      style={theme.tokens}
    >
      {theme.chrome?.scanlines ? (
        <>
          <div className="tartarus-scan" aria-hidden="true" />
          <div className="tartarus-noise" aria-hidden="true" />
        </>
      ) : null}
      {children}
    </div>
  );
}
