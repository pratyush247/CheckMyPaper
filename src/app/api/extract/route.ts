import { NextRequest, NextResponse } from "next/server";
import { extractQuestions, type ImageInput } from "@/lib/ai";

export const maxDuration = 300;

// Accepts multipart form-data with one or more "files" (page images).
// PDFs are rasterized to images on the client before upload, so by the time we
// get here everything is an image that DeepSeek-OCR can read.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    const images: ImageInput[] = [];
    for (const file of files) {
      if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        images.push({ mediaType: file.type as ImageInput["mediaType"], data: b64 });
      }
    }

    const questions = await extractQuestions(images, []);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("extract error", err);
    return NextResponse.json(
      { error: "Could not read the paper. Try clearer photos." },
      { status: 500 },
    );
  }
}
