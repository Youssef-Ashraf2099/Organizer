/**
 * Extract text from PDF files
 * Uses pdfjs-dist for client-side PDF text extraction
 */

import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure pdfjs worker to load from bundled asset (no external fetch)
GlobalWorkerOptions.workerSrc = workerSrc;

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    let fullText = "";

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    return fullText.trim();
  } catch (error) {
    console.error("Failed to extract PDF text:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract text from PDF: ${message}`);
  }
};
