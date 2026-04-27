const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

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

    // Full viewport screenshot
    const fullPath = path.join(outDir, "full.png");
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log("Saved", fullPath);

    // Try to capture the left sidebar element if present
    const aside = await page.$("aside");
    if (aside) {
      const leftPath = path.join(outDir, "left.png");
      await aside.screenshot({ path: leftPath });
      console.log("Saved", leftPath);
    } else {
      console.log("No <aside> element found, skipping sidebar capture.");
    }
  } catch (err) {
    console.error("Capture failed:", err);
  } finally {
    await browser.close();
  }
})();
