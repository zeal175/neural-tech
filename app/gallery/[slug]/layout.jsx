import { notFound } from "next/navigation";
import { getEvent } from "../events";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return { title: "Archive — Neural Tech" };

  const title = `${event.title} — photos — Neural Tech`;
  const description =
    event.blurb || `Photos from ${event.title}, a Neural Tech event.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `/gallery/${event.slug}` },
    twitter: { title, description },
  };
}

export default function EventGalleryLayout({ children }) {
  return children;
}
