import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const html = fs.readFileSync(path.join(root, "assets", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const metadata = fs.readFileSync(path.join(root, "assets", "metadata.js"), "utf8");
const webview = fs.readFileSync(
  path.join(root, "src", "vidcore.webview.ixx"),
  "utf8"
);

for (const id of [
  "previousButton",
  "nextButton",
  "randomButton",
  "favoriteButton",
  "libraryCards",
  "favoritesCards",
  "continueCards",
  "recommendedCards",
  "relatedCards",
  "blockedCards",
  "deleteDialogButton",
  "exportButton",
  "importButton"
]) {
  assert.match(html, new RegExp(`id="${id}"`));
}

for (const script of [
  "storage.js",
  "metadata.js",
  "scanner.js",
  "app.js"
]) {
  assert.match(html, new RegExp(`<script src="${script}"></script>`));
}

assert.match(
  html,
  /<option value="database" selected>Database pick<\/option>/
);
assert.match(html, /data-panel="favorites">Favorites<\/button>/);
assert.match(app, /const names = \["All", "Favorites", \.\.\.customNames\]/);
assert.doesNotMatch(app, /options\.remove/);
assert.match(app, /deleteDialogButton\.classList\.toggle\("hidden", !existing\)/);

assert.match(metadata, /wbgetentities/);
assert.match(metadata, /generator", "search"/);
assert.match(metadata, /scoreWikipediaCandidate/);
assert.match(metadata, /RELATED_REPAIR_LIMIT/);

assert.match(webview, /NewWindowRequested/);
assert.match(webview, /AddScriptToExecuteOnDocumentCreated/);
assert.match(webview, /open-external/);
assert.match(webview, /external-denied/);

console.log("Static feature, metadata-repair, and popup-shield checks passed.");
