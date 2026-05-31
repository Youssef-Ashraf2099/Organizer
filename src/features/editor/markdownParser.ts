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

  // Clean up vote counts and metadata that appears in AI responses (e.g., "+4", "+1", etc.)
  s = s.replace(/\n\s*\+\d+\s*\n/g, "\n");
  s = s.replace(/\s+\+\d+\s*$/gm, "");

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
  // Lists - preserve structure
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

function normalizeCodeLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  if (["js", "javascript", "mjs", "cjs"].includes(value)) return "javascript";
  if (["ts", "typescript", "mts", "cts"].includes(value)) return "typescript";
  if (["sh", "bash", "shell", "shellscript", "zsh"].includes(value))
    return "shellscript";
  if (["plain", "txt", "text"].includes(value)) return "text";
  if (["yml"].includes(value)) return "yaml";
  if (["md"].includes(value)) return "markdown";
  return value;
}

/**
 * Convert markdown string to BlockNote blocks.
 * Also handles HTML output from the AI by converting it to markdown first.
 * Enhanced to support nested lists from AI responses.
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  // Ensure input is a string
  let mdString: string;
  if (typeof markdown !== "string") {
    if (markdown === null || markdown === undefined) return [];
    try {
      mdString =
        typeof markdown === "object"
          ? JSON.stringify(markdown, null, 2)
          : String(markdown);
    } catch {
      return [];
    }
  } else {
    mdString = markdown;
  }

  if (!mdString.trim()) return [];

  // Clean up vote counts and metadata (e.g., "+4", "+1", etc.) from AI responses
  mdString = mdString.replace(/^\s*\+\d+\s*$/gm, "");
  mdString = mdString.replace(/\s+\+\d+\s*$/gm, "");

  // If the AI returned HTML, convert to markdown first
  const cleaned = /<[a-z][\s\S]*>/i.test(mdString)
    ? htmlToMd(mdString)
    : mdString;

  if (typeof cleaned !== "string" || !cleaned.trim()) return [];

  const lines = cleaned.split("\n");
  const blocks: PartialBlock[] = [];
  let i = 0;

  // Helper to get indentation level
  const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    // Count spaces (2 or 4 spaces = 1 level, tabs = 1 level)
    const spaces = match[1];
    const tabCount = (spaces.match(/\t/g) || []).length;
    const spaceCount = spaces.replace(/\t/g, "").length;
    return tabCount + Math.floor(spaceCount / 2);
  };

  // Helper to flatten all list items (BlockNote handles nesting through sequential siblings)
  const flattenListItems = (
    items: Array<{ level: number; type: string; content: any; text: string }>,
  ): PartialBlock[] => {
    return items
      .map((item) => {
        const content = item.text ? parseInlineFormatting(item.text) : [];

        console.debug("Creating list item:", {
          type: item.type,
          text: item.text?.substring(0, 50) || "(empty)",
          contentLength: Array.isArray(content) ? content.length : "N/A",
          hasContent:
            content &&
            (Array.isArray(content) ? content.length > 0 : !!content),
        });

        return {
          type: item.type as any,
          content: content,
        } as PartialBlock;
      })
      .filter((block) => {
        // Only keep blocks that actually have content
        const ctx = (block as any).content;
        if (!ctx) return false;
        if (Array.isArray(ctx) && ctx.length === 0) {
          console.warn("⚠️  Filtering out list item with empty content");
          return false;
        }
        return true;
      });
  };

  // First pass: collect all list items with their levels
  const listItems: Array<{
    level: number;
    type: string;
    content: any;
    text: string;
  }> = [];
  let inListBlock = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines within lists
    if (!trimmed && inListBlock) {
      i++;
      continue;
    }

    // Enhanced list detection - handle various formats from AI responses
    // Check for numbered lists: "1. ", "2. ", etc.
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    // Check for bullet lists: "- ", "* ", "+ ", "• ", "◦ ", etc.
    const bulletMatch = trimmed.match(/^[-*+•◦▪▫]\s+(.+)$/);

    if (numberedMatch || bulletMatch) {
      inListBlock = true;
      const level = getIndentLevel(line);
      let text = numberedMatch ? numberedMatch[2] : bulletMatch![1];

      // Clean up any remaining vote counts or metadata
      text = text.replace(/\s*\+\d+\s*$/, "").trim();

      // DEBUG: Log if text is empty and we have a match
      if (!text) {
        console.warn("⚠️  Empty list item detected after cleaning:", {
          original: trimmed,
          regex: numberedMatch ? "numbered" : "bullet",
        });
      }

      const content = parseInlineFormatting(text);
      const type = numberedMatch ? "numberedListItem" : "bulletListItem";

      listItems.push({ level, type, content, text });
      console.debug("Added list item:", {
        type,
        text: text.substring(0, 50),
        hasContent: !!text,
      });
      i++;
      continue;
    }

    // If we were in a list block and hit a non-list line, process the list
    if (inListBlock && !bulletMatch && !numberedMatch) {
      if (listItems.length > 0) {
        const processedList = flattenListItems(listItems);
        blocks.push(...processedList);
        listItems.length = 0;
      }
      inListBlock = false;
    }

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

    // Code block
    if (trimmed.startsWith("```")) {
      const languageMatch = trimmed.match(/^```\s*([\w-]+)?/);
      const language = normalizeCodeLanguage(
        languageMatch?.[1] ?? "javascript",
      );
      const codeLines: string[] = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```

      const codeContent = codeLines.join("\n");
      blocks.push({
        type: "codeBlock",
        props: { language },
        content: codeContent,
      } as any);
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      const text = quoteMatch[1];
      const content = parseInlineFormatting(text);
      blocks.push({
        type: "paragraph",
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

  // Process any remaining list items
  if (listItems.length > 0) {
    const processedList = flattenListItems(listItems);
    blocks.push(...processedList);
  }

  return blocks;
}

/**
 * Enhanced HTML to Markdown converter for paste handling
 * Properly handles nested lists from AI responses (ChatGPT, Gemini, etc.)
 */
export function htmlToMarkdown(html: string): string {
  // Create a temporary DOM element to parse HTML
  const div = document.createElement("div");
  div.innerHTML = html;

  let markdown = "";
  let listStack: Array<{ type: "ul" | "ol"; counter: number }> = [];

  // Recursive function to traverse DOM
  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || "";
      // Clean up vote counts like "+4", "+1", etc.
      text = text.replace(/\s*\+\d+\s*$/g, "").trim();

      // Only add text if it's not just whitespace, or if we're inside meaningful content
      if (text || listStack.length > 0) {
        markdown += text;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case "div":
        case "p":
          traverseChildren(el);
          // Only add double newline if not immediately followed by a list
          const nextSibling = el.nextElementSibling;
          if (
            !nextSibling ||
            !["ul", "ol"].includes(nextSibling.tagName.toLowerCase())
          ) {
            markdown += "\n\n";
          }
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
          const isOrdered = tagName === "ol";
          const currentDepth = listStack.length;

          listStack.push({
            type: isOrdered ? "ol" : "ul",
            counter: 1,
          });

          // Add newline before top-level lists
          if (currentDepth === 0 && markdown && !markdown.endsWith("\n")) {
            markdown += "\n";
          }

          Array.from(el.children).forEach((child) => {
            if (child.tagName.toLowerCase() === "li") {
              const indent = "  ".repeat(currentDepth);
              const stackTop = listStack[listStack.length - 1];

              // Add the list marker
              if (isOrdered) {
                markdown += `${indent}${stackTop.counter}. `;
                stackTop.counter++;
              } else {
                markdown += `${indent}- `;
              }

              // Process the li content
              traverseChildren(child as HTMLElement);

              // Add newline after each list item
              markdown += "\n";
            }
          });

          listStack.pop();

          // Add extra newline after top-level lists
          if (currentDepth === 0) {
            markdown += "\n";
          }
          break;
        case "li":
          // Should be handled by parent ul/ol, but if standalone:
          const depth = listStack.length;
          const indent = "  ".repeat(Math.max(0, depth - 1));
          markdown += `${indent}- `;
          traverseChildren(el);
          markdown += "\n";
          break;
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          const level = parseInt(tagName[1]);
          const hashes = "#".repeat(level);
          markdown += `\n${hashes} `;
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "pre":
          markdown += "\n```\n";
          traverseChildren(el);
          markdown += "\n```\n";
          break;
        case "blockquote":
          markdown += "\n> ";
          traverseChildren(el);
          markdown += "\n\n";
          break;
        case "a":
          const href = el.getAttribute("href") || "";
          markdown += "[";
          traverseChildren(el);
          markdown += `](${href})`;
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

  // Clean up excessive newlines and trim
  let result = markdown.replace(/\n{3,}/g, "\n\n").trim();

  // Clean up any remaining vote counts
  result = result.replace(/^\s*\+\d+\s*$/gm, "");
  result = result.replace(/\s+\+\d+\s*$/gm, "");

  return result;
}

/**
 * Analyze and reorganize blocks to improve page structure
 * - Detects potential headings (short bold text)
 * - Groups related content
 * - Converts plain text patterns to lists
 * - Fixes broken list items with no content
 */
export function organizePageStructure(blocks: PartialBlock[]): PartialBlock[] {
  if (!blocks || blocks.length === 0) return blocks;

  console.debug("Organizing page structure. Input blocks:", blocks.length);

  const organized: PartialBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // DEBUG: Log each block
    console.debug(`Processing block ${i}:`, {
      type: block.type,
      content: JSON.stringify((block as any).content).substring(0, 100),
      hasContent:
        !!(block as any).content &&
        ((block as any).content.length > 0 ||
          typeof (block as any).content === "string"),
    });

    // Fix broken list items (those with "List" placeholder or empty content)
    if (
      (block.type === "bulletListItem" || block.type === "numberedListItem") &&
      !hasValidContent(block)
    ) {
      console.debug(`Skipping broken list item at ${i}: no content`);
      i++;
      continue; // Skip broken list items
    }

    const blockText = extractBlockText(block);

    // Detect potential headings (bold text that's relatively short and ends with :)
    if (
      block.type === "paragraph" &&
      blockText.length < 100 &&
      blockText.length > 5 &&
      isLikelyHeading(blockText, block)
    ) {
      console.debug("Detected heading:", blockText);
      organized.push({
        type: "heading",
        props: { level: 2 },
        content: (block as any).content,
      } as any);
      i++;
      continue;
    }

    // Check if next items would make a good list
    const potentialListStart = detectListPattern(blocks, i);
    if (potentialListStart.isPattern && potentialListStart.count >= 2) {
      console.debug(
        `Detected list pattern with ${potentialListStart.count} items`,
      );

      // Convert consecutive paragraphs to bullet list
      for (let j = 0; j < potentialListStart.count; j++) {
        const item = blocks[i + j];
        const itemText = extractBlockText(item);

        if (itemText && itemText.trim()) {
          organized.push({
            type: "bulletListItem",
            content: (item as any).content,
          } as any);
        }
      }
      i += potentialListStart.count;
      continue;
    }

    // Keep block as-is if no pattern detected
    organized.push(block);
    i++;
  }

  console.debug(
    "Reorganized structure complete. Output blocks:",
    organized.length,
  );
  return organized;
}

/**
 * Check if a block has valid content (not empty or placeholder)
 */
function hasValidContent(block: PartialBlock): boolean {
  if (!block) return false;

  const content = (block as any).content;

  // String content
  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  // Array content (styled text)
  if (Array.isArray(content)) {
    if (content.length === 0) return false;

    const text = content
      .map((item: any) => item.text || "")
      .join("")
      .trim();

    return text.length > 0;
  }

  return false;
}

/**
 * Extract plain text from a block
 */
function extractBlockText(block: PartialBlock): string {
  if (!block) return "";

  if (typeof (block as any).content === "string") {
    return (block as any).content;
  }

  if (Array.isArray((block as any).content)) {
    return (block as any).content.map((item: any) => item.text || "").join("");
  }

  return "";
}

/**
 * Check if text looks like a heading
 */
function isLikelyHeading(text: string, block: PartialBlock): boolean {
  // Already has bold/strong formatting
  if (
    typeof (block as any).content === "object" &&
    Array.isArray((block as any).content)
  ) {
    const hasBold = (block as any).content.some(
      (item: any) => item.styles?.bold,
    );
    if (hasBold) return true;
  }

  // Ends with colon (like "Section Title:")
  if (text.trim().endsWith(":")) return true;

  // Starts with capital letter and is relatively short
  if (text[0] === text[0].toUpperCase() && text.length < 80) {
    return true;
  }

  return false;
}

/**
 * Detect if multiple consecutive blocks form a list pattern
 */
function detectListPattern(
  blocks: PartialBlock[],
  startIdx: number,
): { isPattern: boolean; count: number } {
  if (startIdx >= blocks.length) return { isPattern: false, count: 0 };

  let count = 0;
  let consecutiveShort = 0;

  for (let i = startIdx; i < blocks.length && i < startIdx + 10; i++) {
    const block = blocks[i];

    // Skip non-paragraph blocks
    if (block.type !== "paragraph") break;

    const text = extractBlockText(block);

    // Look for short items that could be list items
    if (text.length > 10 && text.length < 150) {
      consecutiveShort++;
      count++;
    } else if (text.length <= 10) {
      // Skip very short items
      continue;
    } else {
      // Long text breaks the pattern
      break;
    }
  }

  // A list needs at least 2 similar-length items
  return {
    isPattern: consecutiveShort >= 2,
    count: consecutiveShort,
  };
}
