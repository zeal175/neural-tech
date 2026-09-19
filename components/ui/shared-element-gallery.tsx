"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Download, X } from "lucide-react";

interface ImageData {
  id: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface GalleryContextType {
  selectedImage: ImageData | null;
  setSelectedImage: (image: ImageData | null) => void;
}

const GalleryContext = React.createContext<GalleryContextType | null>(null);

const THUMB_SIZES =
  "(max-width: 560px) 100vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw";
const SHARP_SIZES = "(max-width: 640px) 100vw, 1080px";

const spring = {
  type: "spring" as const,
  stiffness: 350,
  damping: 35,
  mass: 1,
};

function fileNameFromSrc(src: string) {
  try {
    const path = src.split("?")[0] || src;
    return decodeURIComponent(path.split("/").pop() || "") || "photo.jpg";
  } catch {
    return "photo.jpg";
  }
}

const warmed = new Set<string>();

function prefetchSharp(src: string) {
  if (warmed.has(src) || typeof window === "undefined") return;
  warmed.add(src);
  const img = new window.Image();
  img.decoding = "async";
  img.src = `/_next/image?url=${encodeURIComponent(src)}&w=1920&q=88`;
}

async function downloadOriginal(src: string) {
  const name = fileNameFromSrc(src);
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    const link = document.createElement("a");
    link.href = src;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

export function Gallery({ children }: { children: React.ReactNode }) {
  const [selectedImage, setSelectedImage] = React.useState<ImageData | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!selectedImage) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selectedImage]);

  return (
    <GalleryContext.Provider value={{ selectedImage, setSelectedImage }}>
      {children}
      <GalleryModal />
    </GalleryContext.Provider>
  );
}

export function GalleryGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4", className)}>
      {children}
    </div>
  );
}

export function GalleryImage({
  src,
  alt,
  id,
  width,
  height,
  priority = false,
  className,
}: {
  src: string;
  alt?: string;
  id: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const context = React.useContext(GalleryContext);
  if (!context) throw new Error("GalleryImage must be used within a Gallery");

  const reduceMotion = useReducedMotion();
  const w = width || 1200;
  const h = height || 900;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
      whileHover="hover"
      whileTap="tap"
      className={cn(
        "relative mb-1.5 cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl bg-soil/5 sm:mb-2 sm:rounded-2xl",
        className,
      )}
      onPointerEnter={() => prefetchSharp(src)}
      onPointerDown={() => prefetchSharp(src)}
      onClick={() => context.setSelectedImage({ id, src, alt, width: w, height: h })}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        layoutId={`image-${id}`}
        className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl"
        style={{ aspectRatio: `${w} / ${h}` }}
        variants={{
          hover: { scale: 0.98 },
          tap: { scale: 0.95 },
        }}
        transition={spring}
      >
        <Image
          src={src}
          alt={alt || "Gallery image"}
          fill
          sizes={THUMB_SIZES}
          quality={75}
          priority={priority}
          className="object-cover"
        />
      </motion.div>
      <motion.div
        variants={{
          hover: { opacity: 1 },
          tap: { opacity: 1 },
        }}
        initial={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 rounded-xl bg-soil/10 sm:rounded-2xl"
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
}

function LightboxSharp({ src }: { src: string }) {
  const [ready, setReady] = React.useState(false);

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={SHARP_SIZES}
      quality={88}
      priority
      draggable={false}
      onLoad={() => setReady(true)}
      className={cn("object-contain transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
    />
  );
}

function GalleryModal() {
  const context = React.useContext(GalleryContext);
  const [mounted, setMounted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setSaving(false);
  }, [context?.selectedImage?.id]);

  if (!context || !mounted) return null;

  const { selectedImage, setSelectedImage } = context;
  const w = selectedImage?.width || 1600;
  const h = selectedImage?.height || 1067;

  const onDownload = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!selectedImage || saving) return;
    setSaving(true);
    try {
      await downloadOriginal(selectedImage.src);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {selectedImage ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-soil/80 backdrop-blur-2xl"
            onClick={() => setSelectedImage(null)}
          />

          <motion.div
            className="relative z-10 flex h-full w-full cursor-zoom-out items-center justify-center px-3 py-14 sm:p-4"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.8}
            onDragEnd={(_event, info) => {
              if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 300) {
                setSelectedImage(null);
              }
            }}
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              layoutId={`image-${selectedImage.id}`}
              className="relative max-h-[min(82svh,calc(100svh-7.5rem))] overflow-hidden rounded-xl shadow-[0_24px_80px_rgba(65,51,51,0.35)] sm:rounded-2xl"
              style={{
                aspectRatio: `${w} / ${h}`,
                width: `min(100%, calc(82svh * ${w} / ${h}))`,
              }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
            >
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt || "Selected gallery image"}
                fill
                sizes={THUMB_SIZES}
                quality={75}
                priority
                className="object-contain"
                draggable={false}
              />
              <LightboxSharp key={selectedImage.id} src={selectedImage.src} />
            </motion.div>
          </motion.div>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="absolute top-[max(0.85rem,env(safe-area-inset-top))] right-[max(0.85rem,env(safe-area-inset-right))] z-[90] rounded-full bg-cream p-2.5 text-soil transition-colors hover:bg-white"
            onClick={() => setSelectedImage(null)}
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </motion.button>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.12, duration: 0.2 }}
            className="absolute right-[max(0.85rem,env(safe-area-inset-right))] bottom-[max(0.85rem,env(safe-area-inset-bottom))] z-[90] flex h-11 w-11 items-center justify-center rounded-full bg-cream/30 text-cream shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-md ring-1 ring-cream/25 transition-colors hover:bg-cream/45 active:scale-[0.96] disabled:opacity-60"
            onClick={onDownload}
            disabled={saving}
            aria-label="Download original photo"
            aria-busy={saving}
          >
            <Download className="h-[18px] w-[18px]" />
          </motion.button>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
