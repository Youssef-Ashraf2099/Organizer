/**
 * AI Editor Animator
 *
 * Handles the visual feedback for AI operations: smooth slide-in,
 * edit highlight, and replacement transitions on BlockNote blocks.
 *
 * BlockNote DOM structure (what we target):
 *   .bn-editor
 *     .bn-block-group
 *       .bn-block-outer[data-id="..."]
 *         .bn-block
 *           .bn-block-content
 */

export interface AnimatorOptions {
  /** Duration (ms) of the slide-in animation */
  insertDuration: number;
  /** Duration (ms) of the replacement cross-fade */
  replaceDuration: number;
  /** Duration (ms) of the blue edit highlight */
  highlightDuration: number;
  /** Extra scroll offset (px) above the first inserted block */
  scrollOffset: number;
  /** Master toggle – set false to disable all animations */
  enableAnimations: boolean;
}

const DEFAULT_OPTIONS: AnimatorOptions = {
  insertDuration: 500,
  replaceDuration: 600,
  highlightDuration: 3000,
  scrollOffset: 100,
  enableAnimations: true,
};

export class AIEditorAnimator {
  private options: AnimatorOptions;

  constructor(options: Partial<AnimatorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Call after the editor inserts N blocks via AI.
   * Finds the last `count` `.bn-block-outer` elements, applies
   * slide-in + highlight, and scrolls the first one into view.
   */
  public async animateInsertion(count: number): Promise<void> {
    if (!this.options.enableAnimations || count <= 0) return;

    // Wait for React / BlockNote to flush the DOM update
    await this.waitForDom();

    const blocks = this.getLastBlockElements(count);
    if (blocks.length === 0) return;

    // Staggered slide-in
    blocks.forEach((el, i) => {
      this.applyClass(
        el,
        "ai-block-insert",
        this.options.insertDuration + i * 60,
      );
      this.applyClass(
        el,
        "ai-edit-highlight",
        this.options.highlightDuration + i * 60,
      );
    });

    // Scroll the first inserted block into view
    this.scrollIntoView(blocks[0]);
  }

  /**
   * Call after a replace_text operation.
   * Currently behaves the same as insert (highlight + slide-in).
   */
  public async animateReplacement(count: number): Promise<void> {
    if (!this.options.enableAnimations || count <= 0) return;

    await this.waitForDom();

    const blocks = this.getLastBlockElements(count);
    if (blocks.length === 0) return;

    // Quick out → in cross-fade
    blocks.forEach((el) => {
      this.applyClass(el, "ai-replace-in", this.options.replaceDuration);
      this.applyClass(el, "ai-edit-highlight", this.options.highlightDuration);
    });

    this.scrollIntoView(blocks[0]);
  }

  /**
   * Dispatch helper — pick the right animation based on the command action.
   */
  public async handleCommand(
    action: string,
    blockCount: number,
  ): Promise<void> {
    switch (action) {
      case "replace_text":
        await this.animateReplacement(blockCount);
        break;
      case "insert_text":
      case "append_text":
      case "create_kanban":
      case "create_mermaid":
      case "create_chart":
      case "create_math":
      case "insert_image":
        await this.animateInsertion(blockCount);
        break;
      default:
        // Unknown action — still try to highlight
        if (blockCount > 0) await this.animateInsertion(blockCount);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Internals                                                          */
  /* ------------------------------------------------------------------ */

  /** Wait a tick for the DOM to flush after editor mutation */
  private waitForDom(ms = 200): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Grab the last N `.bn-block-outer` elements from the editor DOM */
  private getLastBlockElements(count: number): HTMLElement[] {
    const editor =
      document.querySelector(".bn-editor") ??
      document.querySelector(".ProseMirror");
    if (!editor) {
      console.debug("[AIAnimator] No editor element found in DOM");
      return [];
    }

    // `.bn-block-outer` is the top-level wrapper BlockNote uses per block
    const allBlocks = Array.from(
      editor.querySelectorAll(".bn-block-outer"),
    ) as HTMLElement[];

    console.debug(
      `[AIAnimator] Found ${allBlocks.length} blocks, animating last ${count}`,
    );
    return allBlocks.slice(-count);
  }

  /** Add a CSS class and auto-remove after `duration` ms */
  private applyClass(el: HTMLElement, className: string, duration: number) {
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), duration);
  }

  /** Smooth-scroll the element into the viewport */
  private scrollIntoView(el: HTMLElement) {
    try {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch {
      // Scroll API can throw in edge cases — silently ignore
    }
  }
}

/** Singleton for easy import across components */
export const aiAnimator = new AIEditorAnimator();
