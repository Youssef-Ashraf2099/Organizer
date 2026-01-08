import { PartialBlock } from "@blocknote/core";

/**
 * Parse inline markdown formatting (bold, italic, code)
 * Handles **bold**, *italic*, and `code`
 */
function parseInlineFormatting(text: string): any[] {
  const result: any[] = [];
  let i = 0;

  while (i < text.length) {
    // Check for bold **text**
    if (text.substring(i, i + 2) === "**") {
      const endIdx = text.indexOf("**", i + 2);
      if (endIdx !== -1) {
        const boldText = text.substring(i + 2, endIdx);
        result.push({
          type: "text",
          text: boldText,
          styles: { bold: true },
        });
        i = endIdx + 2;
        continue;
      }
    }

    // Check for italic *text* (but not **)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const endIdx = text.indexOf("*", i + 1);
      if (endIdx !== -1 && text[endIdx - 1] !== "*") {
        const italicText = text.substring(i + 1, endIdx);
        result.push({
          type: "text",
          text: italicText,
          styles: { italic: true },
        });
        i = endIdx + 1;
        continue;
      }
    }

    // Check for code `text`
    if (text[i] === "`") {
      const endIdx = text.indexOf("`", i + 1);
      if (endIdx !== -1) {
        const codeText = text.substring(i + 1, endIdx);
        result.push({
          type: "text",
          text: codeText,
          styles: { code: true },
        });
        i = endIdx + 1;
        continue;
      }
    }

    // Regular text
    let plainEnd = i + 1;
    while (
      plainEnd < text.length &&
      text[plainEnd] !== "*" &&
      text[plainEnd] !== "`"
    ) {
      plainEnd++;
    }
    result.push({ type: "text", text: text.substring(i, plainEnd) });
    i = plainEnd;
  }

  return result;
}

/**
 * Convert markdown string to BlockNote blocks
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  const lines = markdown.split("\n");
  const blocks: PartialBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Heading (# ## ###)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = headingMatch[2];
      const content = parseInlineFormatting(text);

      blocks.push({
        type: "heading",
        props: { level },
        content,
      } as any);
      i++;
      continue;
    }

    // Numbered list (1., 2., etc.)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      const text = numberedMatch[1];
      const content = parseInlineFormatting(text);

      blocks.push({
        type: "bulletListItem",
        content,
      } as any);
      i++;
      continue;
    }

    // Bullet list (-, *, +)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const text = bulletMatch[1];
      const content = parseInlineFormatting(text);

      blocks.push({
        type: "bulletListItem",
        content,
      } as any);
      i++;
      continue;
    }

    // Regular paragraph
    if (trimmed) {
      const content = parseInlineFormatting(trimmed);
      blocks.push({
        type: "paragraph",
        content,
      } as any);
    }

    i++;
  }

  return blocks;
}
