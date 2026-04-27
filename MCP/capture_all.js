const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const FEATURES = [
  "Pages",
  "To-Do",
  "Calendar",
  "Budget",
  "Diagrams",
  "Roadmap",
  "Today Objective",
  "AI Chat",
  "Notifications",
  "Templates",
  "Manage Templates",
  "Open AI Assistant",
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const outDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1366, height: 900 },
  });

  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
    await delay(600);

    // baseline full screenshot
    await page.screenshot({
      path: path.join(outDir, "full.png"),
      fullPage: true,
    });

    // capture the aside if present
    const aside = await page.$("aside");
    if (aside) {
      await aside.screenshot({ path: path.join(outDir, "aside.png") });
    }

    // Try clicking each feature button by visible text
    for (const name of FEATURES) {
      try {
        // Try role-based first
        let btn = page.getByRole("button", { name, exact: false }).first();
        let count = 0;
        try {
          count = await btn.count();
        } catch {
          count = 0;
        }

        if (count === 0) {
          // fallback to text locator
          btn = page.locator(`text=${name}`).first();
          try {
            count = await btn.count();
          } catch {
            count = 0;
          }
        }

        if (count === 0) {
          console.log("Button not found:", name);
          continue;
        }

        await btn.click().catch(() => {});
        // short wait for UI to settle
        await delay(700);

        // capture viewport
        const safeName = name.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
        const outPath = path.join(outDir, `${safeName}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log("Saved", outPath);

        // if clicking opened a modal/panel, capture it too
        await delay(250);
      } catch (err) {
        console.warn("Error capturing feature", name, err?.message || err);
      }
    }

    // capture a right-panel wide shot if right panel exists
    const right = await page.$("div.flex-1");
    if (right) {
      await right
        .screenshot({ path: path.join(outDir, "right_panel.png") })
        .catch(() => {});
    }

    console.log("All captures complete.");
  } catch (err) {
    console.error("Capture failed:", err);
  } finally {
    await browser.close();
  }
})();
