import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.qa.local");
} catch {
  // The assertion below will fail closed unless the QA variables were supplied another way.
}

function valueFromEnvFile(path, key) {
  try {
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));
    return line?.slice(key.length + 1).replace(/^(['"])(.*)\1$/, "$2") ?? "";
  } catch {
    return "";
  }
}

/** Every test script that can write to MySQL must pass this guard before connecting. */
export function assertQaDatabase() {
  const selected = process.env.DATABASE_NAME ?? "";
  const declared = process.env.TEST_DATABASE_NAME ?? "";
  const configuredStore = valueFromEnvFile(".env.local", "DATABASE_NAME");
  const isDedicated = /(?:^|[_-])(?:qa|test)(?:[_-]|$)/i.test(selected);

  if (
    !selected ||
    !declared ||
    selected !== declared ||
    !isDedicated ||
    selected === configuredStore ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Refusing to run a mutating test: set DATABASE_NAME and TEST_DATABASE_NAME to the same dedicated *_qa or *_test schema, separate from .env.local, and do not run tests in production.",
    );
  }
  return selected;
}

export async function connectQaDatabase() {
  assertQaDatabase();
  return mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });
}
