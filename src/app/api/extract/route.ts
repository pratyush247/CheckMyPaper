import { NextRequest, NextResponse } from "next/server";
import { extractQuestions, type ImageInput, type PdfInput } from "@/lib/ai";

export const maxDuration = 120;

// Accepts multipart form-data with one or more "files" (images and/or PDFs),
// runs vision extraction, and returns structured questions.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    const images: ImageInput[] = [];
    const pdfs: PdfInput[] = [];
    for (const file of files) {
      const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      if (file.type === "application/pdf") {
        pdfs.push({ data: b64 });
      } else if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        images.push({ mediaType: file.type as ImageInput["mediaType"], data: b64 });
      }
    }

    const questions = await extractQuestions(images, pdfs);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("extract error", err);
    return NextResponse.json(
      { error: "Could not read the paper. Try a clearer photo or a PDF." },
      { status: 500 },
    );
  }
}
