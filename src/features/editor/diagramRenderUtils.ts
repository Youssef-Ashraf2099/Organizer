import mermaid from "mermaid";

export type MermaidThemePreset = "default" | "dark" | "neutral";

export const normalizeMermaidTheme = (theme: MermaidThemePreset | string) => {
  if (theme === "default" || theme === "dark" || theme === "neutral") {
    return theme;
  }

  if (theme === "contrast-dark" || theme === "hc-dark") {
    return "dark";
  }

  if (theme === "contrast-light" || theme === "hc-light" || theme === "light") {
    return "default";
  }

  return "dark";
};

const buildThemeCss = (textColor: string, edgeTextColor: string) => `
  .nodeLabel,
  .edgeLabel,
  .cluster-label text,
  .messageText,
  .label,
  .label text,
  .label span,
  .legend text,
  foreignObject div,
  foreignObject span,
  text,
  tspan {
    color: ${textColor} !important;
    fill: ${textColor} !important;
  }

  .edgeLabel,
  .edgeLabel span {
    color: ${edgeTextColor} !important;
  }
`;

type RenderMermaidOptions = {
  code: string;
  theme: MermaidThemePreset | string;
  renderId: string;
  padding?: number;
};

const THEME_CONFIGS = {
  default: {
    theme: "base",
    themeVariables: {
      background: "#ffffff",
      primaryColor: "#eff6ff",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#2563eb",
      lineColor: "#334155",
      secondaryColor: "#e2e8f0",
      tertiaryColor: "#f8fafc",
      tertiaryTextColor: "#0f172a",
      clusterBkg: "#f8fafc",
      clusterBorder: "#2563eb",
      edgeLabelBackground: "#ffffff",
      nodeTextColor: "#0f172a",
      actorTextColor: "#0f172a",
      noteTextColor: "#0f172a",
      noteBkgColor: "#ffffff",
      noteBorderColor: "#2563eb",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: "16px",
    },
    themeCSS: buildThemeCss("#0f172a", "#334155"),
  },
  neutral: {
    theme: "base",
    themeVariables: {
      background: "#e2e8f0",
      primaryColor: "#ffffff",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#334155",
      lineColor: "#334155",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#e2e8f0",
      tertiaryTextColor: "#0f172a",
      clusterBkg: "#f8fafc",
      clusterBorder: "#334155",
      edgeLabelBackground: "#f8fafc",
      nodeTextColor: "#0f172a",
      actorTextColor: "#0f172a",
      noteTextColor: "#0f172a",
      noteBkgColor: "#ffffff",
      noteBorderColor: "#334155",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: "16px",
    },
    themeCSS: buildThemeCss("#0f172a", "#334155"),
  },
  dark: {
    theme: "base",
    themeVariables: {
      background: "#020617",
      primaryColor: "#0f172a",
      primaryTextColor: "#f8fafc",
      primaryBorderColor: "#38bdf8",
      lineColor: "#cbd5e1",
      secondaryColor: "#111827",
      tertiaryColor: "#1e293b",
      tertiaryTextColor: "#f8fafc",
      clusterBkg: "#0f172a",
      clusterBorder: "#60a5fa",
      edgeLabelBackground: "#0f172a",
      nodeTextColor: "#f8fafc",
      actorTextColor: "#f8fafc",
      noteTextColor: "#f8fafc",
      noteBkgColor: "#111827",
      noteBorderColor: "#93c5fd",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: "16px",
    },
    themeCSS: buildThemeCss("#f8fafc", "#cbd5e1"),
  },
} as const;

const resolveThemeKey = (theme: MermaidThemePreset | string) => {
  return normalizeMermaidTheme(theme);
};

export const initializeMermaidRenderer = (
  theme: MermaidThemePreset | string,
) => {
  const resolvedTheme = resolveThemeKey(theme);
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    flowchart: { useMaxWidth: true, curve: "basis" },
    ...THEME_CONFIGS[resolvedTheme],
  });
};

const extractSvgFrame = (markup: string) => {
  const parser = new DOMParser();
  const document = parser.parseFromString(markup, "image/svg+xml");
  const svg = document.querySelector("svg");
  if (!svg) return null;

  const viewBox = svg.getAttribute("viewBox");
  const width = Number.parseFloat(svg.getAttribute("width") || "");
  const height = Number.parseFloat(svg.getAttribute("height") || "");

  let [x, y, w, h] = viewBox
    ? viewBox.split(/\s+/).map((value) => Number.parseFloat(value))
    : [0, 0, width, height];
  if (![x, y, w, h].every((value) => Number.isFinite(value))) {
    return null;
  }

  if ((w <= 0 || h <= 0) && Number.isFinite(width) && Number.isFinite(height)) {
    w = width;
    h = height;
  }

  return { svg, x, y, w, h };
};
export const normalizeSvgMarkup = (markup: string, padding = 0) => {
  try {
    const frame = extractSvgFrame(markup);
    if (!frame) return markup;

    const { svg, x, y, w, h } = frame;
    if (padding > 0) {
      svg.setAttribute(
        "viewBox",
        `${x - padding} ${y - padding} ${w + padding * 2} ${h + padding * 2}`,
      );
    } else if (!svg.getAttribute("viewBox")) {
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("shape-rendering", "geometricPrecision");
    svg.setAttribute("text-rendering", "geometricPrecision");

    const style = svg.getAttribute("style") || "";
    svg.setAttribute(
      "style",
      `${style}; max-width: none; overflow: visible; image-rendering: auto; -webkit-font-smoothing: antialiased;`,
    );

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return markup;
  }
};

export const renderMermaidMarkup = async ({
  code,
  theme,
  renderId,
  padding = 24,
}: RenderMermaidOptions) => {
  initializeMermaidRenderer(theme);

  if (mermaid.mermaidAPI) {
    mermaid.mermaidAPI.reset?.();
  }

  const result = await mermaid.render(renderId, code);
  return normalizeSvgMarkup(result.svg, padding);
};

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "diagram";

export const buildDiagramExportName = (
  title: string,
  extension: "svg" | "pdf",
) => `${sanitizeFileName(title)}-${Date.now()}.${extension}`;

export const svgMarkupToImage = (markup: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG image"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
