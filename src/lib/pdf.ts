"use client";

// Rasterizes a PDF into per-page JPEG images in the browser, so the same
// image → DeepSeek-OCR pipeline handles both photos and coaching PDFs.

export async function pdfToImageFiles(file: File, maxPages = 20): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  // Bundle the worker locally (works offline / in the PWA).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = Math.min(doc.numPages, maxPages);
  const out: File[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // ~2x for legible OCR
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.85),
    );
    if (blob) out.push(new File([blob], `${file.name}-p${i}.jpg`, { type: "image/jpeg" }));
  }
  return out;
}
