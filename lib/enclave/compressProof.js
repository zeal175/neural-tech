/** Vercel serverless request body cap is ~4.5 MB — keep proofs under that. */
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Shrink a payment screenshot for upload (canvas → JPEG).
 * Returns the original file if it's already small enough or can't be decoded.
 */
export async function compressProof(file) {
  if (!(file instanceof Blob) || !file.size) return file;
  if (file.size <= 1.2 * 1024 * 1024 && /^image\/(jpeg|webp)$/i.test(file.type || "")) {
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size > MAX_PROOF_BYTES) {
      throw new Error("That image is too large. Try a JPG screenshot under 4 MB.");
    }
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || !blob.size) return file;
    if (blob.size > MAX_PROOF_BYTES) {
      throw new Error("That image is still too large after compress. Try a clearer, cropped screenshot.");
    }

    const base = (file.name || "payment").replace(/\.[^.]+$/, "") || "payment";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}
