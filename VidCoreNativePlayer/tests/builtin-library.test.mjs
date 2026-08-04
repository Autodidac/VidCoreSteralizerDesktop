import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { DecompressionStream } from "node:stream/web";

const directory = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(nativeRoot, "..");

for (const root of [nativeRoot + "/assets", repositoryRoot + "/VidCoreWebPlayer"]) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.indexOf('class="transport panel"') < html.indexOf('class="source-panel panel"'));
  assert.ok(html.indexOf('class="source-panel panel"') < html.indexOf('class="current-card panel"'));
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
  const library = await context.VidCoreBuiltInLibraryPromise;
  assert.equal(library.version, 2);
  assert.equal(library.favorites.length, 105);
  assert.equal(library.lists.length, 24);
  assert.equal(library.history.length, 0);
}

const storage = fs.readFileSync(path.join(nativeRoot, "assets", "storage.js"), "utf8");
assert.match(storage, /BUILTIN_SEED_STATE_KEY/);
assert.match(storage, /knownFavorites\.has\(entry\.key\)/);
assert.match(storage, /if \(!await state\.backend\.get\(STORES\.favorites, entry\.key\)\)/);
console.log("Built-in library merge and lower-control layout checks passed.");
