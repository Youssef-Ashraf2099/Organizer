figma.showUI(__html__, { width: 480, height: 360 });

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "import-images") {
    const files = Array.isArray(msg.files) ? msg.files : [];
    figma.notify(`Received ${files.length} file(s)`);

    if (files.length === 0) {
      figma.ui.postMessage({ type: "no-files" });
      return;
    }

    const createdNodes = [];
    const errors = [];
    for (const file of files) {
      if (!file || !file.data) {
        const name = file && file.name ? file.name : "<unknown>";
        console.warn("Skipping invalid file entry", name);
        errors.push({ name, message: "no-data" });
        continue;
      }

      try {
        const bytes = base64ToUint8Array(file.data);
        const image = figma.createImage(bytes);
        const rect = figma.createRectangle();
        rect.fills = [
          { type: "IMAGE", scaleMode: "FILL", imageHash: image.hash },
        ];
        rect.resize(900, Math.round((900 * 9) / 16));
        rect.x = 0;
        rect.y = figma.currentPage.children.length * 24;
        figma.currentPage.appendChild(rect);
        createdNodes.push(rect);
      } catch (e) {
        const name = file && file.name ? file.name : "<unknown>";
        const message = e && e.message ? e.message : String(e);
        console.error("Failed to import", name, e);
        errors.push({ name, message });
      }
    }

    if (createdNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(createdNodes);
      figma.notify(`Imported ${createdNodes.length} image(s)`);
      figma.ui.postMessage({
        type: "imported",
        count: createdNodes.length,
        errors,
      });
    } else {
      figma.notify("No images were imported (check plugin for details)");
      figma.ui.postMessage({ type: "import-failed", errors });
    }
  }
};
