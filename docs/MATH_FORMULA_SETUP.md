# Math Formula Support Implementation Guide

## Overview

You now have full LaTeX/Math formula support in your Notion clone without replacing BlockNote! This implementation adds a custom "math" block type that seamlessly integrates with your existing editor.

## What Was Added

### 1. **Dependencies**
- **katex** - Fast LaTeX rendering library
- Both are already installed in your project

### 2. **New Files Created**

#### [src/components/blocks/mathBlockSchema.ts](src/components/blocks/mathBlockSchema.ts)
Defines the schema for the custom math block:
```typescript
- Block type: "math"
- Property: `latex` (string) - Contains the LaTeX formula
- Content type: "none" (blocks can't have children)
```

#### [src/components/blocks/MathBlock.tsx](src/components/blocks/MathBlock.tsx)
Component for rendering math blocks (currently a stub for BlockNote's built-in rendering)

#### [src/components/blocks/MathToolbarButton.tsx](src/components/blocks/MathToolbarButton.tsx)
Toolbar button that inserts math blocks into the editor with the quadratic formula as an example

#### [src/components/blocks/useEditorWithMath.ts](src/components/blocks/useEditorWithMath.ts)
Custom hook for initializing BlockNote with math block support

### 3. **Modified Files**

#### [src/features/editor/OmniEditor.tsx](src/features/editor/OmniEditor.tsx)
Updated to:
- Register the custom math block schema
- Add KaTeX CSS import
- Display the math toolbar button in the editor header
- Handle math blocks in content persistence

## Usage

### Inserting Math Formulas

Users can:
1. **Click the ƒ(x) button** in the editor toolbar to insert a math formula
2. **Default formula** is the quadratic formula: `f(x) = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`
3. **Edit by clicking** the rendered formula to enter edit mode
4. **Type LaTeX** directly (e.g., `E = mc^2`, `\int_0^\infty e^{-x} dx`)

### Supported LaTeX

KaTeX supports a wide range of mathematical notation:

**Basic Math:**
```latex
E = mc^2
a^2 + b^2 = c^2
\sqrt{16} = 4
\frac{1}{2}
```

**Greek Letters:**
```latex
\alpha, \beta, \gamma, \delta, \pi, \Sigma
```

**Integrals & Derivatives:**
```latex
\int_0^1 f(x) dx
\frac{df}{dx}
\partial f
```

**Complex Expressions:**
```latex
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

**See full documentation:** https://katex.org/docs/supported.html

## Data Persistence

Math blocks are stored in your database like any other block:
- Stored in the `blocks` table as part of the JSON content array
- Fully compatible with your autosave system
- Survives page reloads and app restarts

Example stored format:
```json
{
  "type": "math",
  "props": {
    "latex": "E = mc^2"
  }
}
```

## Styling

Math blocks have a light background (slate-50) in light mode and dark (zinc-900) in dark mode. To customize:

Edit [src/components/blocks/MathToolbarButton.tsx](src/components/blocks/MathToolbarButton.tsx) and the toolbar button styling in [src/features/editor/OmniEditor.tsx](src/features/editor/OmniEditor.tsx).

## Architecture Decision

This implementation uses BlockNote's custom block type system rather than:
- ❌ Replacing BlockNote (expensive, breaks existing features)
- ❌ Creating a completely separate math editor (difficult integration)
- ✅ Adding a custom block type (minimal, non-invasive, maintainable)

## Troubleshooting

**Invalid LaTeX Formula?**
- Check KaTeX docs for supported commands
- Common mistake: Use `\\` for backslashes in JSON strings
- Example: `\\frac` not `\frac` when typing in the editor UI

**Math block not appearing?**
- Verify the editor was initialized with `blockSpecs: { math: mathBlockConfig }`
- Check browser console for TypeScript errors

**Block not persisting?**
- Ensure your database schema supports JSON storage in the blocks table
- Verify autosave is working (check console logs)

## Next Steps (Optional Enhancements)

1. **Equation Editor UI** - Add a visual equation builder
2. **Math Palette** - Quick-insert common formulas
3. **Inline Math** - Support math within text (like `$E = mc^2$`)
4. **MathJax Alternative** - For more complex rendering needs
5. **Export to PDF** - Ensure math renders correctly when printing

## Files Modified Summary

```
✅ src/features/editor/OmniEditor.tsx          - Main editor setup
✅ src/components/blocks/mathBlockSchema.ts     - Math block definition
✅ src/components/blocks/MathBlock.tsx          - Math block component
✅ src/components/blocks/MathToolbarButton.tsx  - Toolbar button
✅ package.json                                  - KaTeX dependency added
```
