/* global console, process */

/**
 * Post-install patch for zotero-plugin-scaffold.
 *
 * The scaffold's `tiny-update-notifier` dependency can throw an ETIMEDOUT
 * AggregateError that becomes an uncaughtException (the HTTP request object
 * has no `error` listener), causing `process.exit(1)` even when the build
 * itself succeeds.
 *
 * This patch adds a `CI` / `NO_UPDATE_NOTIFIER` guard to the scaffold's
 * `updateNotifier` function so the network check can be skipped entirely.
 *
 * Run automatically via the "postinstall" script in package.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scaffoldCliPath = resolve(
  __dirname,
  "node_modules/zotero-plugin-scaffold/dist/cli.mjs",
);

const SEARCH = `function updateNotifier(name, version) {
  tinyUpdateNotifier`;
const REPLACE = `function updateNotifier(name, version) {
  if (process.env.CI || process.env.NO_UPDATE_NOTIFIER) return;
  tinyUpdateNotifier`;

try {
  const content = readFileSync(scaffoldCliPath, "utf-8");
  if (content.includes("NO_UPDATE_NOTIFIER")) {
    console.log("[patch-scaffold-notifier] Already patched, skipping.");
    process.exit(0);
  }
  if (!content.includes(SEARCH)) {
    console.warn(
      "[patch-scaffold-notifier] Target string not found. " +
        "The scaffold source may have changed. Skipping patch.",
    );
    process.exit(0);
  }
  const patched = content.replace(SEARCH, REPLACE);
  writeFileSync(scaffoldCliPath, patched, "utf-8");
  console.log("[patch-scaffold-notifier] Patched cli.mjs successfully.");
} catch (err) {
  console.error("[patch-scaffold-notifier] Failed to patch:", err.message);
  // Non-fatal: the build still works, just may exit non-zero on timeout.
  process.exit(0);
}
