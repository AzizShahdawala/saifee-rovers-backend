import { spawn } from "child_process";

const python = process.env.PYTHON_BIN || "python3";
const children = [];
let shuttingDown = false;

function start(command, args, name) {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} failed to start:`, error.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${name} exited unexpectedly (${signal || code})`);
      shutdown(code || 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 1500).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

start(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000", "--app-dir", "ai"], "AI service");
start(process.execPath, ["server.js"], "Node API");
