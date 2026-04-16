import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import mermaid from "mermaid";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FaProjectDiagram } from "@react-icons/all-files/fa/FaProjectDiagram";
import { FaDownload } from "@react-icons/all-files/fa/FaDownload";
import { FaFilePdf } from "@react-icons/all-files/fa/FaFilePdf";
import { FaCode } from "@react-icons/all-files/fa/FaCode";
import { FaRedo } from "@react-icons/all-files/fa/FaRedo";
import { FaSearchPlus } from "@react-icons/all-files/fa/FaSearchPlus";
import { FaSearchMinus } from "@react-icons/all-files/fa/FaSearchMinus";
import { FaExpand } from "@react-icons/all-files/fa/FaExpand";
import { FaCompress } from "@react-icons/all-files/fa/FaCompress";
import { FaSave } from "@react-icons/all-files/fa/FaSave";
import { FaFolderOpen } from "@react-icons/all-files/fa/FaFolderOpen";
import { FaImage } from "@react-icons/all-files/fa/FaImage";
import { useDiagramStore } from "../../core/store/diagramStore";
import type { DiagramSourceType } from "../../core/services/diagramService";

type DiagramThemePreset = "hc-dark" | "hc-light";

type DiagramTemplate = {
  key: string;
  label: string;
  description: string;
  code: string;
};

const TEMPLATES: DiagramTemplate[] = [
  {
    key: "architecture",
    label: "Architecture",
    description: "Software or infrastructure architecture overview",
    code: `flowchart LR
  U[Users] --> CDN[CDN]
  CDN --> LB[Load Balancer]
  LB --> API1[API Node 1]
  LB --> API2[API Node 2]
  API1 --> DB[(Primary DB)]
  API2 --> DB
  API1 --> CACHE[(Redis Cache)]
  API2 --> CACHE
  DB --> B[(Backup Storage)]`,
  },
  {
    key: "erd",
    label: "ERD",
    description: "Database entity relationship diagram",
    code: `erDiagram
  USERS ||--o{ ORDERS : places
  USERS ||--o{ ADDRESSES : has
  ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : appears_in

  USERS {
    int id PK
    string email
    string full_name
    datetime created_at
  }

  ORDERS {
    int id PK
    int user_id FK
    decimal total_amount
    string status
    datetime created_at
  }

  ORDER_ITEMS {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
    decimal unit_price
  }

  PRODUCTS {
    int id PK
    string sku
    string title
    decimal price
    bool is_active
  }

  ADDRESSES {
    int id PK
    int user_id FK
    string line1
    string city
    string country
  }`,
  },
  {
    key: "flowchart",
    label: "Flowchart",
    description: "Decision and process flow",
    code: `flowchart TD
  A([Start]) --> B{Request Valid?}
  B -- No --> C[Return Validation Error]
  C --> Z([End])
  B -- Yes --> D[Authenticate User]
  D --> E{Authorized?}
  E -- No --> F[Return 403]
  F --> Z
  E -- Yes --> G[Process Request]
  G --> H[Persist Data]
  H --> I[Return Success]
  I --> Z`,
  },
  {
    key: "sequence",
    label: "Sequence",
    description: "Service interaction timeline",
    code: `sequenceDiagram
  actor U as User
  participant W as Web App
  participant A as API
  participant D as Database

  U->>W: Submit Form
  W->>A: POST /items
  A->>D: INSERT item
  D-->>A: OK
  A-->>W: 201 Created
  W-->>U: Show Success`,
  },
  {
    key: "state",
    label: "State",
    description: "Lifecycle state machine",
    code: `stateDiagram-v2
  [*] --> Draft
  Draft --> Review : submit
  Review --> Draft : request_changes
  Review --> Approved : approve
  Approved --> Published : publish
  Published --> Archived : archive
  Archived --> [*]`,
  },
  {
    key: "hardware",
    label: "Hardware Topology",
    description: "Computer/hardware system topology",
    code: `flowchart TB
  ISP[Internet ISP] --> FW[Firewall]
  FW --> CORE[Core Switch]
  CORE --> ESX1[VM Host 1]
  CORE --> ESX2[VM Host 2]
  CORE --> NAS[(NAS Storage)]
  CORE --> MGMT[Management VLAN]
  ESX1 --> VMDB[(DB VM)]
  ESX2 --> VMAPP[App VM]
  VMAPP --> VMDB
  NAS --> BAK[(Offsite Backup)]`,
  },
];

const THEME_PRESETS = {
  "hc-dark": {
    label: "High Contrast Dark",
    containerClass: "bg-slate-950 border-slate-700",
    mermaid: {
      theme: "base",
      themeVariables: {
        background: "#020617",
        primaryColor: "#111827",
        primaryTextColor: "#f8fafc",
        primaryBorderColor: "#7dd3fc",
        lineColor: "#cbd5e1",
        secondaryColor: "#0f172a",
        tertiaryColor: "#1e293b",
        tertiaryTextColor: "#f8fafc",
        clusterBkg: "#0f172a",
        clusterBorder: "#60a5fa",
        edgeLabelBackground: "#0f172a",
        mainBkg: "#111827",
        nodeTextColor: "#f8fafc",
        actorTextColor: "#f8fafc",
        noteTextColor: "#f8fafc",
        noteBkgColor: "#1e293b",
        noteBorderColor: "#93c5fd",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
      },
    },
  },
  "hc-light": {
    label: "High Contrast Light",
    containerClass: "bg-white border-slate-300",
    mermaid: {
      theme: "base",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#f8fafc",
        primaryTextColor: "#0f172a",
        primaryBorderColor: "#1d4ed8",
        lineColor: "#334155",
        secondaryColor: "#e2e8f0",
        tertiaryColor: "#f1f5f9",
        tertiaryTextColor: "#0f172a",
        clusterBkg: "#f8fafc",
        clusterBorder: "#2563eb",
        edgeLabelBackground: "#ffffff",
        mainBkg: "#f8fafc",
        nodeTextColor: "#0f172a",
        actorTextColor: "#0f172a",
        noteTextColor: "#0f172a",
        noteBkgColor: "#ffffff",
        noteBorderColor: "#2563eb",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
      },
    },
  },
} as const;

const DEFAULT_TEMPLATE = TEMPLATES[0];
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 12;

const normalizeSvgForViewport = (markup: string) => {
  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(markup, "image/svg+xml");
    const svg = document.querySelector("svg");
    if (!svg) return markup;

    const width = Number.parseFloat(svg.getAttribute("width") || "");
    const height = Number.parseFloat(svg.getAttribute("height") || "");
    const hasViewBox = Boolean(svg.getAttribute("viewBox"));

    if (
      !hasViewBox &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("shape-rendering", "geometricPrecision");
    svg.setAttribute("text-rendering", "geometricPrecision");
    svg.setAttribute("vector-effect", "non-scaling-stroke");

    const style = svg.getAttribute("style") || "";
    svg.setAttribute(
      "style",
      `${style}; max-width: none; image-rendering: auto; -webkit-font-smoothing: antialiased;`,
    );

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return markup;
  }
};

export const DiagramStudio = () => {
  const folders = useDiagramStore((state) => state.folders);
  const activeFolderId = useDiagramStore((state) => state.activeFolderId);
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId);
  const loadLibrary = useDiagramStore((state) => state.loadLibrary);
  const createDiagram = useDiagramStore((state) => state.createDiagram);
  const updateDiagram = useDiagramStore((state) => state.updateDiagram);

  const activeDiagram = useMemo(() => {
    for (const folder of folders) {
      const diagram = folder.diagrams.find(
        (item) => item.id === activeDiagramId,
      );
      if (diagram) return diagram;
    }

    return null;
  }, [activeDiagramId, folders]);

  const [activeTemplateKey, setActiveTemplateKey] = useState(
    DEFAULT_TEMPLATE.key,
  );
  const [draftName, setDraftName] = useState(DEFAULT_TEMPLATE.label);
  const [draftCode, setDraftCode] = useState(DEFAULT_TEMPLATE.code);
  const [draftThemePreset, setDraftThemePreset] =
    useState<DiagramThemePreset>("hc-dark");
  const [draftSourceType, setDraftSourceType] =
    useState<DiagramSourceType>("mermaid");
  const [draftSvgMarkup, setDraftSvgMarkup] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgInputRef = useRef<HTMLInputElement>(null);

  const activeSvgMarkup =
    draftSourceType === "svg"
      ? draftSvgMarkup || activeDiagram?.svgMarkup || svgMarkup
      : svgMarkup;

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (activeDiagram) {
      setDraftName(activeDiagram.name);
      setDraftCode(activeDiagram.code);
      setDraftThemePreset(
        (activeDiagram.themePreset as DiagramThemePreset) || "hc-dark",
      );
      setDraftSourceType(activeDiagram.sourceType);
      setDraftSvgMarkup(activeDiagram.svgMarkup);
      setActiveTemplateKey(activeDiagram.templateKey || DEFAULT_TEMPLATE.key);
      setSvgMarkup(activeDiagram.svgMarkup || "");
      setError(null);
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    setDraftName(DEFAULT_TEMPLATE.label);
    setDraftCode(DEFAULT_TEMPLATE.code);
    setDraftThemePreset("hc-dark");
    setDraftSourceType("mermaid");
    setDraftSvgMarkup(null);
    setActiveTemplateKey(DEFAULT_TEMPLATE.key);
    setSvgMarkup("");
    setError(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [activeDiagram]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const activeTemplate = useMemo(
    () =>
      TEMPLATES.find((template) => template.key === activeTemplateKey) ??
      DEFAULT_TEMPLATE,
    [activeTemplateKey],
  );

  const renderMermaid = async (nextCode = draftCode) => {
    if (draftSourceType === "svg") {
      const markup = draftSvgMarkup || activeDiagram?.svgMarkup || "";
      if (!markup) {
        setError("No SVG markup is available for this diagram.");
        return;
      }

      setSvgMarkup(normalizeSvgForViewport(markup));
      return;
    }

    setIsRendering(true);
    setError(null);

    try {
      const preset = THEME_PRESETS[draftThemePreset];
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        ...preset.mermaid,
      });

      const renderId = `diagram-studio-${Date.now()}`;
      const result = await mermaid.render(renderId, nextCode);
      setSvgMarkup(normalizeSvgForViewport(result.svg));
    } catch (e: any) {
      setError(e?.message ?? "Failed to render diagram");
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    renderMermaid(draftCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCode, draftThemePreset, draftSourceType, activeDiagram?.id]);

  const applyTemplate = (template: DiagramTemplate) => {
    setDraftSourceType("mermaid");
    setDraftSvgMarkup(null);
    setActiveTemplateKey(template.key);
    setDraftName(template.label);
    setDraftCode(template.code);
    setTimeout(() => {
      renderMermaid(template.code);
    }, 0);
  };

  const handleImportExternalSvg = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (!text.includes("<svg")) {
        setError("Selected file is not a valid SVG document.");
        return;
      }

      setError(null);
      setDraftSourceType("svg");
      const normalized = normalizeSvgForViewport(text);
      setDraftSvgMarkup(normalized);
      setSvgMarkup(normalized);
      setDraftName(file.name.replace(/\.svg$/i, "") || "Imported Diagram");
    } catch {
      setError("Failed to load SVG file.");
    } finally {
      event.target.value = "";
    }
  };

  const saveCurrentDiagram = async () => {
    const folderId =
      activeDiagram?.folderId ?? activeFolderId ?? folders[0]?.id ?? null;
    if (!folderId) {
      setError("Create a folder first before saving a diagram.");
      return;
    }

    const diagramName = draftName.trim() || activeTemplate.label;
    const svgContent =
      draftSourceType === "svg"
        ? draftSvgMarkup || svgMarkup || activeDiagram?.svgMarkup
        : svgMarkup;
    const payload = {
      folderId,
      name: diagramName,
      sourceType: draftSourceType,
      templateKey: draftSourceType === "mermaid" ? activeTemplateKey : null,
      code: draftSourceType === "svg" ? svgContent || "" : draftCode,
      svgMarkup: svgContent || null,
      themePreset: draftThemePreset,
    };

    try {
      if (activeDiagram) {
        await updateDiagram(activeDiagram.id, payload);
      } else {
        await createDiagram(payload);
      }
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save diagram",
      );
    }
  };

  const exportSvg = () => {
    if (!activeSvgMarkup) return;

    const blob = new Blob([activeSvgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(draftName || activeTemplate.key).replace(/\s+/g, "-")}-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!previewRef.current) return;

    const canvas = await html2canvas(previewRef.current, {
      scale: 2,
      backgroundColor: draftThemePreset === "hc-dark" ? "#020617" : "#ffffff",
      useCORS: true,
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;

    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    const drawWidth = canvas.width * ratio;
    const drawHeight = canvas.height * ratio;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    pdf.addImage(imageData, "PNG", x, y, drawWidth, drawHeight);
    pdf.save(
      `${(draftName || activeTemplate.key).replace(/\s+/g, "-")}-${Date.now()}.pdf`,
    );
  };

  const zoom = (direction: 1 | -1) => {
    setScale((current) =>
      clamp(current + direction * 0.25, MIN_ZOOM, MAX_ZOOM),
    );
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    const container = previewRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.18 : -0.18;
    setScale((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const deltaX = event.clientX - dragStateRef.current.x;
    const deltaY = event.clientY - dragStateRef.current.y;
    setPan({
      x: dragStateRef.current.panX + deltaX,
      y: dragStateRef.current.panY + deltaY,
    });
  };

  const stopPanning = () => {
    setIsPanning(false);
  };

  const isSvgDiagram = draftSourceType === "svg";

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaProjectDiagram className="text-cyan-400" />
              Diagram Studio
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Use the folder library on the left to organize diagrams, then pan,
              zoom, and fullscreen the canvas here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={svgInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleImportExternalSvg}
              className="hidden"
            />

            <button
              onClick={() => svgInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm font-medium"
            >
              <FaImage size={12} />
              Import SVG
            </button>

            <select
              value={draftThemePreset}
              onChange={(event) =>
                setDraftThemePreset(event.target.value as DiagramThemePreset)
              }
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              disabled={isSvgDiagram}
            >
              <option value="hc-dark">High Contrast Dark</option>
              <option value="hc-light">High Contrast Light</option>
            </select>

            <button
              onClick={() => renderMermaid(draftCode)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              <FaRedo size={12} />
              Render
            </button>

            <button
              onClick={saveCurrentDiagram}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm font-medium"
            >
              <FaSave size={12} />
              Save
            </button>

            <button
              onClick={exportSvg}
              disabled={!activeSvgMarkup}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FaDownload size={12} />
              Export SVG
            </button>

            <button
              onClick={exportPdf}
              disabled={!activeSvgMarkup}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FaFilePdf size={12} />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <FaFolderOpen size={12} />
              <span>
                {folders.find((folder) => folder.id === activeFolderId)?.name ||
                  "No folder selected"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="text-zinc-500">Diagram:</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="min-w-[240px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                placeholder="Diagram name"
              />
            </div>

            <div className="text-xs text-zinc-500">
              {draftSourceType === "svg" ? "SVG mode" : "Mermaid mode"}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4 mt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <FaCode size={12} />
                Mermaid Code
              </h3>
              <textarea
                value={draftCode}
                onChange={(event) => {
                  setDraftSourceType("mermaid");
                  setDraftCode(event.target.value);
                  setDraftSvgMarkup(null);
                }}
                className="w-full min-h-[340px] bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs leading-5 font-mono text-zinc-100"
                spellCheck={false}
                disabled={isSvgDiagram}
              />

              <p className="text-[11px] text-zinc-500">
                Use templates for ERD, flowcharts, and architecture diagrams.
                Imported SVG diagrams can be viewed, zoomed, and exported.
              </p>

              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-500 uppercase">
                  Quick Templates
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.key}
                      onClick={() => applyTemplate(template)}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition ${activeTemplate.key === template.key ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
                    >
                      <div className="text-sm font-medium">
                        {template.label}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Canvas
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Drag to move, use the mouse wheel or buttons to zoom, and
                    fullscreen for detailed inspection.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-cyan-300">
                    {(scale * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => zoom(-1)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
                  >
                    <FaSearchMinus size={12} />
                    Zoom Out
                  </button>
                  <button
                    onClick={resetView}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => zoom(1)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
                  >
                    <FaSearchPlus size={12} />
                    Zoom In
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm"
                  >
                    {isFullscreen ? (
                      <FaCompress size={12} />
                    ) : (
                      <FaExpand size={12} />
                    )}
                    {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  </button>
                </div>
              </div>

              <div
                ref={previewRef}
                className={`relative overflow-hidden rounded-2xl border min-h-[640px] ${THEME_PRESETS[draftThemePreset].containerClass}`}
                onWheel={onWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={stopPanning}
                onPointerCancel={stopPanning}
                onPointerLeave={stopPanning}
                style={{ cursor: isPanning ? "grabbing" : "grab" }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_35%)] pointer-events-none" />

                <div className="absolute inset-0 overflow-hidden">
                  {isRendering && (
                    <div className="absolute top-4 left-4 text-sm text-zinc-400 z-10">
                      Rendering diagram...
                    </div>
                  )}

                  {!error && activeSvgMarkup ? (
                    <div
                      className="absolute left-1/2 top-1/2 select-none"
                      style={{
                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "center center",
                      }}
                      dangerouslySetInnerHTML={{ __html: activeSvgMarkup }}
                    />
                  ) : !error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                      Render a diagram to see the preview here.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
