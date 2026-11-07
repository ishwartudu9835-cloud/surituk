/**
 * Turns a PDF into one image per page, entirely in the browser (pdf.js),
 * so creators can upload a chapter as a single PDF.
 */
export async function pdfToImages(
  file: File,
  onProgress?: (done: number, total: number) => void,
  opts: { maxWidth?: number; quality?: number; maxPages?: number } = {},
): Promise<File[]> {
  const { maxWidth = 1400, quality = 0.85, maxPages = 200 } = opts;
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = Math.min(doc.numPages, maxPages);
  const base = file.name.replace(/\.pdf$/i, "");
  const out: File[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / unscaled.width, 3);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("Could not convert page"))), "image/jpeg", quality));
    out.push(new File([blob], `${base}-${String(i).padStart(3, "0")}.jpg`, { type: "image/jpeg" }));
    page.cleanup();
    canvas.width = canvas.height = 0;
    onProgress?.(i, total);
  }
  await doc.cleanup();
  return out;
}
