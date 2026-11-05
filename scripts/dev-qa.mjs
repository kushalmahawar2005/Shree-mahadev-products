import { spawn } from "node:child_process";

try {
  process.loadEnvFile(".env.qa.local");
} catch {
  console.error("Create the ignored .env.qa.local before starting the QA server.");
  process.exit(1);
}

if (process.env.DATABASE_NAME !== "swadeshi_mahadev_qa" || process.env.PAYU_MODE !== "test") {
  console.error("QA server refused to start without the dedicated schema and PAYU_MODE=test.");
  process.exit(1);
}

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3005"], {
  stdio: "inherit",
  env: process.env,
});
next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
