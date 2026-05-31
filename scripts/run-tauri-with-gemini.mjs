import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const geminiDir = path.join(repoRoot, "gemini-web2api");
const geminiUrl = process.env.AI_GEMINI_BASE_URL || "http://127.0.0.1:8081/v1";
const geminiModelsUrl = `${geminiUrl.replace(/\/$/, "")}/models`;
const command = process.argv[2] || "dev";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWindows() {
  return process.platform === "win32";
}

function pythonCandidates() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  if (isWindows()) {
    candidates.push(path.join(repoRoot, ".venv", "Scripts", "python.exe"));
    candidates.push("python");
  } else {
    candidates.push(path.join(repoRoot, ".venv", "bin", "python"));
    candidates.push("python3");
    candidates.push("python");
  }
  return candidates;
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findPython() {
  for (const candidate of pythonCandidates()) {
    if (candidate.includes(path.sep) && fileExists(candidate)) {
      return candidate;
    }
    if (!candidate.includes(path.sep)) {
      return candidate;
    }
  }
  return "python";
}

async function geminiIsReady() {
  try {
    const response = await fetch(geminiModelsUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForGemini(timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await geminiIsReady()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function spawnProcess(commandName, args, options = {}) {
  return spawn(commandName, args, {
    stdio: "inherit",
    ...options,
  });
}

async function startGeminiBackend() {
  if (await geminiIsReady()) {
    console.log(
      `[launcher] Gemini Web2API already running at ${geminiModelsUrl}`,
    );
    return null;
  }

  const python = await findPython();
  console.log(`[launcher] Starting Gemini Web2API with ${python}`);

  const child = spawnProcess(
    python,
    ["gemini_web2api.py", "--config", "config.json", "--port", "8081"],
    { cwd: geminiDir },
  );

  const ready = await waitForGemini();
  if (!ready) {
    child.kill();
    throw new Error(
      `Gemini Web2API did not become ready at ${geminiModelsUrl}`,
    );
  }

  console.log("[launcher] Gemini Web2API is ready.");
  return child;
}

async function runTauri(commandName) {
  const child = isWindows()
    ? spawnProcess(
        "cmd.exe",
        ["/c", "npm", "exec", "--", "tauri", commandName],
        {
          cwd: repoRoot,
        },
      )
    : spawnProcess("npm", ["exec", "--", "tauri", commandName], {
        cwd: repoRoot,
      });

  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`tauri ${commandName} terminated by ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

async function main() {
  if (!["dev", "build", "preview"].includes(command)) {
    console.error(`[launcher] Unsupported command: ${command}`);
    process.exit(1);
  }

  const backend = await startGeminiBackend();

  const cleanup = () => {
    if (backend && !backend.killed) {
      backend.kill();
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  try {
    const exitCode = await runTauri(command);
    cleanup();
    process.exit(exitCode);
  } catch (error) {
    cleanup();
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
