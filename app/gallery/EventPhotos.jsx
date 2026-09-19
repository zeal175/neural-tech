"use client";

import { useEffect, useMemo, useState } from "react";
import { Gallery, GalleryImage } from "@/components/ui/shared-element-gallery";

const FALLBACK = [
  {
    id: "live-floor",
    src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=80",
    alt: "A packed hall watching a stage",
    width: 1400,
    height: 933,
  },
  {
    id: "laptops",
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80",
    alt: "People working around a table of laptops",
    width: 1400,
    height: 933,
  },
  {
    id: "crowd",
    src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1400&q=80",
    alt: "An audience under stage lights",
    width: 1400,
    height: 2100,
  },
  {
    id: "workshop",
    src: "https://images.unsplash.com/photo-1524178232363-1fb2b075b955?auto=format&fit=crop&w=1400&q=80",
    alt: "A workshop in progress",
    width: 1400,
    height: 1050,
  },
  {
    id: "night",
    src: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
    alt: "A conference floor at night",
    width: 1400,
    height: 933,
  },
  {
    id: "team",
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80",
    alt: "A team huddled over a screen",
    width: 1400,
    height: 933,
  },
  {
    id: "talk",
    src: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1400&q=80",
    alt: "Someone speaking to a room",
    width: 1400,
    height: 1866,
  },
  {
    id: "build",
    src: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1400&q=80",
    alt: "Hands on a keyboard in a dim room",
    width: 1400,
    height: 933,
  },
];

const SHIFTS = [0, 40, 18, 56];

function useColumnCount() {
  const [count, setCount] = useState(2);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setCount(width >= 1100 ? 4 : width >= 800 ? 3 : 2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

function packColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));

  items.forEach((item) => {
    const ratio = item.width && item.height ? item.height / item.width : 1.15;
    const shortest = columns.reduce((left, right) => (left.height <= right.height ? left : right));
    shortest.items.push(item);
    shortest.height += ratio;
  });

  return columns.map((column) => column.items);
}

export default function EventPhotos({ photos = [] }) {
  const columnCount = useColumnCount();
  const items = photos.length
    ? photos.map((photo, index) => ({
        id: photo.file || `photo-${index + 1}`,
        src: photo.src,
        alt: photo.alt || photo.caption || `Photo ${index + 1}`,
        width: photo.width,
        height: photo.height,
      }))
    : FALLBACK;

  const columns = useMemo(() => packColumns(items, columnCount), [items, columnCount]);

  return (
    <Gallery>
      <div className="flex items-start gap-1.5 sm:gap-2">
        {columns.map((column, index) => (
          <div
            key={index}
            className="min-w-0 flex-1"
            style={{ paddingTop: columnCount > 1 ? SHIFTS[index % SHIFTS.length] : 0 }}
          >
            {column.map((image, imageIndex) => (
              <GalleryImage
                key={image.id}
                id={image.id}
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                priority={index < 2 && imageIndex < 2}
              />
            ))}
          </div>
        ))}
      </div>
    </Gallery>
  );
}
