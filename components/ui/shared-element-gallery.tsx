"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

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

const spring = {
  type: "spring" as const,
  stiffness: 350,
  damping: 35,
  mass: 1,
};

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

  const w = width || 1200;
  const h = height || 900;

  return (
    <motion.div
      whileHover="hover"
      whileTap="tap"
      className={cn(
        "relative mb-4 cursor-zoom-in break-inside-avoid overflow-hidden rounded-2xl bg-soil/5",
        className,
      )}
      onClick={() => context.setSelectedImage({ id, src, alt, width: w, height: h })}
    >
      <motion.div
        layoutId={`image-${id}`}
        className="relative w-full overflow-hidden rounded-2xl"
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
          sizes="(max-width: 560px) 100vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"
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
        className="pointer-events-none absolute inset-0 rounded-2xl bg-soil/10"
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
}

function GalleryModal() {
  const context = React.useContext(GalleryContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!context || !mounted) return null;

  const { selectedImage, setSelectedImage } = context;
  const w = selectedImage?.width || 1600;
  const h = selectedImage?.height || 1067;

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
            className="relative z-10 flex h-full w-full cursor-zoom-out items-center justify-center p-4"
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
              className="relative overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(65,51,51,0.35)]"
              style={{
                aspectRatio: `${w} / ${h}`,
                width: `min(95vw, calc(90vh * ${w} / ${h}))`,
              }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
            >
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt || "Selected gallery image"}
                fill
                sizes="90vw"
                quality={88}
                priority
                className="object-contain"
                draggable={false}
              />
            </motion.div>
          </motion.div>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="absolute top-6 right-6 z-[90] rounded-full bg-cream p-2.5 text-soil transition-colors hover:bg-white"
            onClick={() => setSelectedImage(null)}
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
