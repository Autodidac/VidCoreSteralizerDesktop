import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourcePath = path.join(repositoryRoot, "VidCoreNativePlayer", "import.json");
const imported = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

if (imported?.format !== "vidcore-native-library" || imported?.version !== 2) {
  throw new Error("VidCoreNativePlayer/import.json must be a version 2 VidCore backup.");
}
if (!Array.isArray(imported.favorites) || !Array.isArray(imported.lists)) {
  throw new Error("The import must contain favorites and lists arrays.");
}

const payload = {
  format: imported.format,
  version: imported.version,
  exportedAt: imported.exportedAt,
  providers: Array.isArray(imported.providers) ? imported.providers : [],
  favorites: imported.favorites,
  lists: imported.lists,
  history: []
};
const compressed = zlib
  .deflateSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 })
  .toString("base64");
const moduleSource = [
  '"use strict";',
  "",
  "(() => {",
  '  const encoded = "' + compressed + '";',
  '  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));',
  "",
  "  globalThis.VidCoreBuiltInLibraryPromise = (async () => {",
  '    if (typeof DecompressionStream !== "function") {',
  '      throw new Error("This browser cannot unpack the built-in VidCore library.");',
  "    }",
  "",
  "    const stream = new Blob([bytes])",
  "      .stream()",
  '      .pipeThrough(new DecompressionStream("deflate"));',
  "    return new Response(stream).json();",
  "  })();",
  "})();",
  ""
].join("\n");

for (const relativePath of [
  path.join("VidCoreWebPlayer", "builtin-library.js"),
  path.join("VidCoreNativePlayer", "assets", "builtin-library.js")
]) {
  fs.writeFileSync(path.join(repositoryRoot, relativePath), moduleSource);
}

console.log(
  "Built " + payload.favorites.length + " defaults, " +
  payload.lists.length + " lists, and zero history entries."
);