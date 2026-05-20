/**
 * blockSerializer.ts
 *
 * Converts BlockNote's internal document to a compact, AI-readable
 * plain-text description. This replaces the old markdown dump so the
 * AI receives precise, structured context about what's on the page —
 * without wasting context-window tokens on markdown syntax noise.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlockSummary {
  /** Compact text sent to the AI engine as page context. */
  text: string;
  /** Raw block count. */
  blockCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((s: any) => (typeof s?.text === "string" ? s.text : ""))
      .join("")
      .trim();
  }
  return "";
}

function headingPrefix(level: number): string {
  return "#".repeat(Math.min(Math.max(level, 1), 6)) + " ";
}

// ─── Main Serializer ──────────────────────────────────────────────────────────

/**
 * Converts an array of BlockNote blocks into a compact AI-context string.
 *
 * Format: `[block_type] content` — one line per block, with type prefix so
 * the AI knows exactly what exists and in what form (heading vs paragraph vs kanban…).
 *
 * Custom/media blocks are described by label only (no binary data).
 */
export function serializeBlocksForAI(blocks: any[]): BlockSummary {
  if (!blocks || blocks.length === 0) {
    return { text: "(empty page)", blockCount: 0 };
  }

  const lines: string[] = [];

  for (const block of blocks) {
    const type: string = block.type ?? "paragraph";
    const text = extractText(block.content);
    const props: any = block.props ?? {};

    switch (type) {
      case "heading": {
        const level = props.level ?? 1;
        lines.push(`${headingPrefix(level)}${text}`);
        break;
      }
      case "bulletListItem":
        lines.push(`- ${text}`);
        break;
      case "numberedListItem":
        lines.push(`1. ${text}`);
        break;
      case "paragraph":
        if (text) lines.push(text);
        break;
      case "math":
        lines.push(`[math] ${props.latex ?? "(formula)"}`);
        break;
      case "mermaid":
        lines.push(`[mermaid diagram] ${(props.code ?? "").slice(0, 60)}…`);
        break;
      case "chart":
        lines.push(`[chart block] type=${props.chartType ?? "unknown"}`);
        break;
      case "kanban":
        lines.push(`[kanban board]`);
        break;
      case "image":
        lines.push(`[image] ${props.alt ?? props.fileName ?? "untitled"}`);
        break;
      case "video":
        lines.push(`[video] ${props.fileName ?? "untitled"}`);
        break;
      case "audio":
        lines.push(`[audio] ${props.fileName ?? "untitled"}`);
        break;
      case "pdf":
        lines.push(`[pdf] ${props.fileName ?? "untitled"}`);
        break;
      default:
        if (text) lines.push(`[${type}] ${text}`);
        else lines.push(`[${type}]`);
    }
  }

  return {
    text: lines.join("\n"),
    blockCount: blocks.length,
  };
}
