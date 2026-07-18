import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";

const children = [];
let shuttingDown = false;
const python = process.env.PYTHON_BIN || (process.platform === "win32" && existsSync(path.resolve("ai", "python", "python.exe")) ? path.resolve("ai", "python", "python.exe") : "python3");
const recognitionPort = process.env.FACE_SERVICE_PORT || "8000";
const childEnv = { ...process.env, AI_SERVICE_URL: process.env.AI_SERVICE_URL || `http://127.0.0.1:${recognitionPort}` };

function start(command, args, name) {
  const child = spawn(command, args, { stdio: "inherit", env: childEnv, windowsHide: true });
  children.push(child);
  child.on("error", (error) => { console.error(`${name} failed to start: ${error.message}`); shutdown(1); });
  child.on("exit", (code, signal) => { if (!shuttingDown) { console.error(`${name} stopped unexpectedly (${signal || code})`); shutdown(code || 1); } });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1000).unref();
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
start(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", recognitionPort, "--app-dir", "ai"], "Face recognition service");
start(process.execPath, [path.resolve("node_modules", "nodemon", "bin", "nodemon.js"), "server.js"], "Node API");
