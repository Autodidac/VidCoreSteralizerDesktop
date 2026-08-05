import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { DecompressionStream } from "node:stream/web";

const directory = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(nativeRoot, "..");
const imported = JSON.parse(
  fs.readFileSync(path.join(nativeRoot, "import.json"), "utf8")
);
const expectedBuiltIn = {
  format: imported.format,
  version: imported.version,
  exportedAt: imported.exportedAt,
  providers: imported.providers,
  favorites: imported.favorites,
  lists: imported.lists,
  history: []
};

for (const root of [nativeRoot + "/assets", repositoryRoot + "/VidCoreWebPlayer"]) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.indexOf('class="current-card panel"') < html.indexOf('class="source-panel panel"'));
  assert.ok(html.indexOf('class="source-panel panel"') < html.indexOf('id="playerShell"'));
  assert.ok(html.indexOf('src="builtin-library.js"') < html.indexOf('src="storage.js"'));

  const context = {
    atob: value => Buffer.from(value, "base64").toString("binary"),
    Uint8Array,
    Blob,
    Response,
    DecompressionStream
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "builtin-library.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "builtin-additions.js"), "utf8"), context);
  const library = await context.VidCoreBuiltInLibraryPromise;
  assert.deepEqual(
    JSON.parse(JSON.stringify(library)),
    expectedBuiltIn,
    "generated built-ins must exactly match import.json except for seeded history"
  );
  assert.equal(library.version, 2);
  assert.equal(library.favorites.length, 236);
  assert.equal(library.lists.length, 27);
  assert.equal(library.history.length, 0);

  const titles = new Set(library.favorites.map(entry => entry.title));
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
    assert.ok(titles.has(title), `missing built-in title: ${title}`);
  }
  assert.ok(library.lists.some(list => list.name === "Fantasy"));
  assert.ok(library.lists.some(list => list.name === "Avengers"));
  assert.ok(library.lists.some(list => list.name === "Time"));
  const indianaJones = library.favorites.filter(entry =>
    entry.title === "Raiders of the Lost Ark" ||
    entry.title.startsWith("Indiana Jones")
  );
  assert.equal(indianaJones.length, 5);
  assert.ok(indianaJones.every(entry => entry.list === "Action"));
  assert.equal(
    library.favorites.filter(entry => entry.mode === "movie" && entry.id === "226674").length,
    2,
    "provider-specific copies from import.json must both remain seeded"
  );
}

const storage = fs.readFileSync(path.join(nativeRoot, "assets", "storage.js"), "utf8");
assert.match(storage, /BUILTIN_SEED_STATE_KEY/);
assert.match(storage, /knownFavorites\.has\(entry\.key\)/);
assert.match(storage, /if \(!await state\.backend\.get\(STORES\.favorites, entry\.key\)\)/);
console.log("Built-in library union, list additions, and compact top-layout checks passed.");
