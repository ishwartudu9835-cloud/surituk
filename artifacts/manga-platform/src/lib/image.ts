/**
 * Shrinks/converts photos in the browser before upload, so big phone-camera photos
 * (often 5–15 MB) upload fast and stay under the server limits.
 */
const PASS_THROUGH = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PIXELS = 16_000_000; // mobile browsers can't make bigger canvases

type Opts = { maxWidth: number; maxHeight: number; maxBytes: number };

async function decode(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; close: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>(res => c.toBlob(res, type, q));

export async function prepareImage(file: File, o: Opts): Promise<File> {
  let d;
  try { d = await decode(file); }
  catch {
    if (PASS_THROUGH.has(file.type) && file.size <= o.maxBytes) return file;
    throw new Error(`"${file.name}" can't be read. Please use a JPG or PNG photo (iPhone/Samsung HEIC photos: take a screenshot or change camera format to "Most compatible").`);
  }
  try {
    let scale = Math.min(1, o.maxWidth / d.w, o.maxHeight / d.h);
    if (d.w * d.h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (d.w * d.h));
    const keep = scale >= 1 && file.size <= o.maxBytes && PASS_THROUGH.has(file.type);
    if (keep) return file; // already fine — keep original quality (and GIF animation)

    const w = Math.max(1, Math.round(d.w * scale)), h = Math.max(1, Math.round(d.h * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(d.img, 0, 0, w, h);
    let blob: Blob | null = null;
    for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
      blob = await toBlob(c, "image/jpeg", q);
      if (blob && blob.size <= o.maxBytes) break;
    }
    c.width = c.height = 0;
    if (!blob) throw new Error(`Couldn't process "${file.name}"`);
    if (blob.size > o.maxBytes) throw new Error(`"${file.name}" is too large even after compressing`);
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    d.close();
  }
}

const MB = 1024 * 1024;
/** Settings per upload endpoint. Chapter pages keep full width for crisp reading; tall webtoon strips are allowed. */
export const IMAGE_PRESETS: Record<string, Opts> = {
  "/uploads/avatar": { maxWidth: 800, maxHeight: 800, maxBytes: 4 * MB },
  "/uploads/image": { maxWidth: 2400, maxHeight: 2400, maxBytes: 8 * MB },
  "/uploads/images": { maxWidth: 1600, maxHeight: 20000, maxBytes: 8 * MB },
};
