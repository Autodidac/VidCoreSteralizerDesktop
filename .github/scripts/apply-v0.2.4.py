from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SEED_B64 = "".join(
    (Path(__file__).parent / f"seed-v0.2.4.part{index}").read_text(encoding="ascii").strip()
    for index in range(5)
)

BUILTIN_JS = r'''"use strict";

(() => {
  const encoded = "__SEED__";
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));

  globalThis.VidCoreBuiltInLibraryPromise = (async () => {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot unpack the built-in VidCore library.");
    }

    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Response(stream).json();
  })();
})();
'''.replace("__SEED__", SEED_B64)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing expected {label}")
    return text.replace(old, new, 1)


def patch_index(path):
    text = path.read_text(encoding="utf-8")
    pair = re.compile(
        r'(        <section class="source-panel panel">.*?        </section>\n\n'
        r'        <section class="current-card panel">.*?        </section>\n\n)',
        re.S,
    )
    match = pair.search(text)
    if not match:
        raise RuntimeError(f"Could not find source/current sections in {path}")
    blocks = match.group(1)
    text = text[:match.start()] + text[match.end():]

    transport = re.compile(
        r'(        <section class="transport panel">.*?        </section>\n)',
        re.S,
    )
    text, count = transport.subn(r"\1\n" + blocks.rstrip() + "\n", text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not find transport section in {path}")

    marker = '  <script src="storage.js"></script>'
    if 'src="builtin-library.js"' not in text:
        text = replace_once(
            text,
            marker,
            '  <script src="builtin-library.js"></script>\n' + marker,
            f"storage script marker in {path}",
        )
    path.write_text(text, encoding="utf-8", newline="\n")


def patch_storage(path):
    text = path.read_text(encoding="utf-8")
    if "BUILTIN_SEED_STATE_KEY" not in text:
        text = replace_once(
            text,
            '  const FALLBACK_PREFIX = "vidcoreNative.fallback.";\n',
            '  const FALLBACK_PREFIX = "vidcoreNative.fallback.";\n'
            '  const BUILTIN_SEED_STATE_KEY = "vidcoreNative.builtinSeedState.v1";\n',
            f"fallback prefix in {path}",
        )

    if "await mergeBuiltInLibrary();" not in text:
        text = replace_once(
            text,
            '      return state.backend;\n',
            '      await mergeBuiltInLibrary();\n\n      return state.backend;\n',
            f"storage initialize return in {path}",
        )

    if "async function mergeBuiltInLibrary()" not in text:
        marker = "  async function exportData(extra = {}) {"
        function = r'''  async function mergeBuiltInLibrary() {
    let payload = globalThis.VidCoreBuiltInLibrary;
    if (!payload && globalThis.VidCoreBuiltInLibraryPromise) {
      try {
        payload = await globalThis.VidCoreBuiltInLibraryPromise;
      } catch {
        return { favorites: 0, lists: 0 };
      }
    }

    if (!payload || typeof payload !== "object" || !state.backend) {
      return { favorites: 0, lists: 0 };
    }

    let seedState = { favorites: [], lists: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(BUILTIN_SEED_STATE_KEY) || "{}");
      if (saved && typeof saved === "object") {
        seedState = {
          favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
          lists: Array.isArray(saved.lists) ? saved.lists : []
        };
      }
    } catch {
    }

    const knownFavorites = new Set(seedState.favorites);
    const knownLists = new Set(seedState.lists);
    const providers = readProviderCatalog(payload);
    const lists = Array.isArray(payload.lists) ? payload.lists : [];
    const favorites = (Array.isArray(payload.favorites) ? payload.favorites : [])
      .map(entry => expandEntry(entry, providers))
      .filter(Boolean);
    let addedLists = 0;
    let addedFavorites = 0;

    for (const list of lists) {
      const name = String(list?.name || "").trim();
      if (!name || knownLists.has(name)) continue;
      if (!await state.backend.get(STORES.lists, name)) {
        await state.backend.put(STORES.lists, list);
        addedLists += 1;
      }
      knownLists.add(name);
    }

    for (const entry of favorites) {
      if (!entry.key || knownFavorites.has(entry.key)) continue;
      if (!await state.backend.get(STORES.favorites, entry.key)) {
        await state.backend.put(STORES.favorites, entry);
        addedFavorites += 1;
      }
      knownFavorites.add(entry.key);
    }

    try {
      localStorage.setItem(BUILTIN_SEED_STATE_KEY, JSON.stringify({
        version: String(payload.exportedAt || payload.version || "builtin"),
        favorites: [...knownFavorites],
        lists: [...knownLists]
      }));
    } catch {
    }

    return { favorites: addedFavorites, lists: addedLists };
  }

'''
        text = replace_once(text, marker, function + marker, f"export marker in {path}")

    path.write_text(text, encoding="utf-8", newline="\n")


def patch_validate(path):
    text = path.read_text(encoding="utf-8")
    if "builtin-library.js" not in text:
        marker = "node --check assets\\storage.js\nif errorlevel 1 exit /b %errorlevel%\n"
        text = replace_once(
            text,
            marker,
            marker + "\nnode --check assets\\builtin-library.js\nif errorlevel 1 exit /b %errorlevel%\n",
            "validate storage check",
        )
    if "builtin-library.test.mjs" not in text:
        marker = "node tests\\providers.test.mjs\nif errorlevel 1 exit /b %errorlevel%\n"
        text = replace_once(
            text,
            marker,
            marker + "\nnode tests\\builtin-library.test.mjs\nif errorlevel 1 exit /b %errorlevel%\n",
            "provider test marker",
        )
    path.write_text(text, encoding="utf-8", newline="\n")


def write_test(path):
    path.write_text(r'''import assert from "node:assert/strict";
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
''', encoding="utf-8", newline="\n")


def main():
    for folder in (ROOT / "VidCoreNativePlayer" / "assets", ROOT / "VidCoreWebPlayer"):
        (folder / "builtin-library.js").write_text(BUILTIN_JS, encoding="utf-8", newline="\n")
        patch_index(folder / "index.html")
        patch_storage(folder / "storage.js")

    patch_validate(ROOT / "VidCoreNativePlayer" / "validate.bat")
    write_test(ROOT / "VidCoreNativePlayer" / "tests" / "builtin-library.test.mjs")

    cmake = ROOT / "VidCoreNativePlayer" / "CMakeLists.txt"
    cmake_text = cmake.read_text(encoding="utf-8").replace("VERSION 0.2.3", "VERSION 0.2.4", 1)
    if "VERSION 0.2.4" not in cmake_text:
        raise RuntimeError("CMake version bump failed")
    cmake.write_text(cmake_text, encoding="utf-8", newline="\n")
    (ROOT / "VERSION").write_text("0.2.4\n", encoding="utf-8", newline="\n")

    mission = ROOT / "missioncache.md"
    mission_text = mission.read_text(encoding="utf-8")
    additions = (
        "- [x] Move Play/provider controls and the resolve metadata card below the Stop/transport section.\n"
        "- [x] Bundle the supplied 105-title, 24-list library into both players.\n"
        "- [x] Merge only previously unseen built-in titles and lists without overwriting edits or restoring deleted seed items.\n"
        "- [x] Publish release `v0.2.4` with the built-in starter library.\n"
    )
    if "Bundle the supplied 105-title" not in mission_text:
        mission_text = mission_text.replace("## Open / provider-limited\n", additions + "\n## Open / provider-limited\n", 1)
    mission.write_text(mission_text, encoding="utf-8", newline="\n")

    for relative in ("README.md", "VidCoreNativePlayer/README.md", "VidCoreWebPlayer/README.md"):
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        note = "\n- v0.2.4 places playback/resolve controls below transport and includes a non-destructive built-in starter library.\n"
        if "non-destructive built-in starter library" not in text:
            text += note
        path.write_text(text, encoding="utf-8", newline="\n")

    for relative in ("VidCoreNativePlayer/assets/index.html", "VidCoreWebPlayer/index.html"):
        html = (ROOT / relative).read_text(encoding="utf-8")
        assert html.index('class="transport panel"') < html.index('class="source-panel panel"')
        assert html.index('src="builtin-library.js"') < html.index('src="storage.js"')


if __name__ == "__main__":
    main()
