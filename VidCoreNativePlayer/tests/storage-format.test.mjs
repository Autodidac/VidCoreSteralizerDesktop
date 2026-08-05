import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const code = fs.readFileSync(path.join(root, "assets", "storage.js"), "utf8");
const stores = new Map();
const localStorage = {
  getItem(key) { return stores.has(key) ? stores.get(key) : null; },
  setItem(key, value) { stores.set(key, String(value)); }
};
const context = {
  URL,
  localStorage,
  indexedDB: undefined,
  console,
  setTimeout,
  clearTimeout
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);
await context.VidCoreStorage.initialize();
const S = context.VidCoreStorage.STORES;
await context.VidCoreStorage.put(S.favorites, {
  key: "https://ythd.org/embed|movie|tt0466342",
  baseUrl: "https://ythd.org/embed",
  mode: "movie",
  id: "tt0466342",
  title: "Date Movie",
  list: "Comedy",
  favorite: true
});
const backup = await context.VidCoreStorage.exportData();
assert.equal(backup.version, 2);
assert.deepEqual(
  [...backup.providers].slice(0, 3).map(provider => provider.id),
  ["vidcore", "ythd", "vidup"]
);
assert.equal(backup.favorites[0].provider, 1);
assert.equal("baseUrl" in backup.favorites[0], false);
assert.equal("key" in backup.favorites[0], false);

await context.VidCoreStorage.clear(S.favorites);
await context.VidCoreStorage.importData({
  format: "vidcore-native-library",
  version: 1,
  favorites: [{
    key: "https://vidup.to|movie|550",
    baseUrl: "https://vidup.to",
    mode: "movie",
    id: "550",
    title: "Fight Club",
    list: "Favorites"
  }],
  lists: [],
  history: []
});
let imported = await context.VidCoreStorage.getAll(S.favorites);
assert.equal(imported[0].baseUrl, "https://vidup.to");
assert.equal(imported[0].favorite, true);
assert.equal(imported[0].list, "Uncategorized");

await context.VidCoreStorage.clear(S.favorites);
await context.VidCoreStorage.importData(backup);
imported = await context.VidCoreStorage.getAll(S.favorites);
assert.equal(imported[0].baseUrl, "https://ythd.org/embed");
assert.equal(imported[0].favorite, true);
assert.equal(imported[0].list, "Comedy");
console.log("Compact provider backup and legacy import checks passed.");
