import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const html = fs.readFileSync(path.join(root, "assets", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const metadata = fs.readFileSync(path.join(root, "assets", "metadata.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");
const additions = fs.readFileSync(path.join(root, "assets", "builtin-additions.js"), "utf8");
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
  "importButton",
  "fastflixButton",
  "seeflixButton",
  "movies123Button",
  "deleteListButton",
  "saveFavorite",
  "saveNewListName",
  "saveAddListButton"
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
assert.match(app, /function isFavoriteEntry/);
assert.match(app, /local-artwork/);
assert.match(app, /ensureRelated/);
assert.doesNotMatch(app, /options\.remove/);
assert.match(app, /deleteDialogButton\.classList\.toggle\("hidden", !existing\)/);

assert.match(metadata, /wbgetentities/);
assert.match(metadata, /generator", "search"/);
assert.match(metadata, /scoreWikipediaCandidate/);
assert.match(metadata, /RELATED_REPAIR_LIMIT/);
assert.match(metadata, /isLikelyBadArtwork/);
assert.match(metadata, /searchCommonsArtwork/);
assert.match(metadata, /externalCatalogUrls/);
assert.ok(
  html.indexOf('class="current-card panel"') <
  html.indexOf('class="source-panel panel"')
);
assert.ok(
  html.indexOf('class="source-panel panel"') <
  html.indexOf('id="playerShell"')
);
assert.match(html, /Shielded Native Stream Player/);
assert.doesNotMatch(html, /id="blockedCount"/);
assert.match(html, /builtin-additions\.js/);
assert.match(styles, /--primary: #2f8cff/);
assert.match(styles, /aspect-ratio: 1/);
assert.match(app, /async function deleteSelectedList/);
assert.match(app, /VidCoreStorage\.remove\(VidCoreStorage\.STORES\.lists, name\)/);
assert.match(app, /favorite: elements\.saveFavorite\.checked/);
assert.match(app, /list: "Uncategorized"/);
assert.doesNotMatch(app, /staleEmptyLists/);
assert.match(app, /async function addListFromDialog/);
assert.match(app, /state\.selectedList = destinationList/);
assert.match(app, /showPanel\("library"\)/);
for (const title of [
  "Wednesday",
  "Landman",
  "Mating Season",
  "Reacher",
  "Dexter: Resurrection",
  "The Sandman",
  "Cape Fear",
  "TV 298714 · S1 E1",
  "TV 319179 · S1 E1",
  "Raiders of the Lost Ark",
  "Indiana Jones and the Temple of Doom",
  "Indiana Jones and the Last Crusade",
  "Indiana Jones and the Kingdom of the Crystal Skull",
  "Indiana Jones and the Dial of Destiny"
]) {
  assert.ok(additions.includes(`"title": "${title}"`));
}
assert.ok(additions.includes('"name": "Fantasy"'));

assert.match(webview, /NewWindowRequested/);
assert.match(webview, /AddScriptToExecuteOnDocumentCreated/);
assert.match(webview, /open-external/);
assert.match(webview, /external-denied/);
assert.match(webview, /fastflix\.to/);
assert.match(webview, /123moviesfree\.net/);
assert.match(webview, /executable_directory/);
assert.match(webview, /local-artwork/);
assert.match(webview, /artwork_root/);
assert.match(webview, /README\.txt/);
assert.doesNotMatch(webview, /blocked-count/);
assert.doesNotMatch(webview, /resolve-image|delete-image-cache|prune-image-cache/);
assert.doesNotMatch(webview, /WinHttpOpen|ImageCache/);

console.log("Static feature, merged defaults, popup-shield, and Defender-safe host checks passed.");
