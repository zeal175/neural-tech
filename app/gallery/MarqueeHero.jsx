import Image from "next/image";

const SHOT_H = 150;

export default function MarqueeHero({ photos }) {
  if (!photos?.length) return null;

  const set = photos.length >= 8 ? photos : Array.from({ length: 8 }, (_, i) => photos[i % photos.length]);
  const loop = [...set, ...set];

  return (
    <div className="ar-film" aria-hidden="true">
      <div className="ar-film-track">
        {loop.map((photo, index) => {
          const width = photo.width || 3;
          const height = photo.height || 2;
          return (
            <a
              key={`${photo.src}-${index}`}
              className="ar-film-shot"
              href={photo.href}
              style={{ width: `${Math.round((SHOT_H * width) / height)}px` }}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="240px"
                quality={60}
                className="object-cover"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
