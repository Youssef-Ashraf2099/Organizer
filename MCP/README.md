# MCP helper — capture + Figma import

This folder contains helper tools to capture your running app's UI (dark mode) and import the screenshots into Figma using a small developer plugin.

Files added

- `capture.js` — Playwright script that captures a full-page and the left `aside` (if present) and writes them to `MCP/screenshots/`.
- `package.json` — small npm project to run the capture script.
- `figma-plugin/` — a simple Figma plugin (manifest + code + UI) that imports local images into the current Figma file.

Quick steps

1. Install dependencies for the capture script:

```bash
cd "e:/Joe Tasks/Organizer/MCP"
npm install
```

2. Make sure your dev server is running (we used `http://localhost:1420`). Then capture dark screenshots:

```bash
npm run capture
```

Screenshots will be saved to `MCP/screenshots/full.png` and `MCP/screenshots/left.png` (if an `aside` element exists).

3. Create a new Figma file manually named `Organizer UI Captures (dark)` (or any name) and open it.

4. Install the plugin locally in Figma (Development → `Import plugin from manifest...` or `Load unpacked plugin` depending on the Figma client): point it to `e:/Joe Tasks/Organizer/MCP/figma-plugin/manifest.json`.

5. Run the plugin (Plugins → Development → `Import Organizer Screenshots`). Choose the two images from `MCP/screenshots/` and click `Import Selected Images`.

Notes

- Figma's REST API doesn't allow creating brand-new Figma files from third-party servers; the recommended approach is to create a file in Figma and use this plugin to import the images into that file.
- The plugin runs inside the Figma client and asks you to select local images; it does not send your images to any external server.

If you want, I can:

- attempt to upload the images to a file inside an existing Figma file (requires a file key you own), or
- prepare a ZIP of the screenshots for you to manually upload.
