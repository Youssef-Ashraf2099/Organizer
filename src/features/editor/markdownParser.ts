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
 * Strip HTML tags and convert common HTML elements to markdown equivalents
 * so the block parser can handle AI-generated HTML gracefully.
 */
function htmlToMd(input: string): string {
  let s = input;
  // Convert headings
  s = s.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
  s = s.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
  s = s.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");
  s = s.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n");
  s = s.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n");
  s = s.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n");
  // Bold / italic
  s = s.replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)>(.*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  // Lists
  s = s.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  s = s.replace(/<\/?[uo]l[^>]*>/gi, "\n");
  // Line breaks & paragraphs
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  // Strip any remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s;
}

/**
 * Convert markdown string to BlockNote blocks.
 * Also handles HTML output from the AI by converting it to markdown first.
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  // If the AI returned HTML, convert to markdown first
  const cleaned = /<[a-z][\s\S]*>/i.test(markdown)
    ? htmlToMd(markdown)
    : markdown;
  const lines = cleaned.split("\n");
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

/**
 * Basic HTML to Markdown converter for paste handling
 */
export function htmlToMarkdown(html: string): string {
  // Create a temporary DOM element to parse HTML
  const div = document.createElement("div");
  div.innerHTML = html;

  let markdown = "";

  // Recursive function to traverse DOM
  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Escape special markdown characters if needed, but for now simple text
      markdown += node.textContent;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case "div":
        case "p":
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "br":
          markdown += "\n";
          break;
        case "strong":
        case "b":
          markdown += "**";
          traverseChildren(el);
          markdown += "**";
          break;
        case "em":
        case "i":
          markdown += "*";
          traverseChildren(el);
          markdown += "*";
          break;
        case "code":
          markdown += "`";
          traverseChildren(el);
          markdown += "`";
          break;
        case "ul":
        case "ol":
          markdown += "\n";
          Array.from(el.children).forEach((child) => {
            if (child.tagName.toLowerCase() === "li") {
              markdown += tagName === "ul" ? "- " : "1. ";
              traverseChildren(child as HTMLElement);
              markdown += "\n";
            }
          });
          markdown += "\n";
          break;
        case "li":
          // Should be handled by parent ul/ol, but if fallback:
          markdown += "- ";
          traverseChildren(el);
          markdown += "\n";
          break;
        case "h1":
          markdown += "\n# ";
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "h2":
          markdown += "\n## ";
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "h3":
          markdown += "\n### ";
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "pre":
          markdown += "\n```\n";
          traverseChildren(el);
          markdown += "\n```\n";
          break;
        default:
          traverseChildren(el);
      }
    }
  }

  function traverseChildren(el: HTMLElement) {
    el.childNodes.forEach((child) => traverse(child));
  }

  traverse(div);

  // Clean up excessive newlines
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
