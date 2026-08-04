from __future__ import annotations

from pathlib import Path
import re
import shutil

ROOT = Path.cwd()
NATIVE = ROOT / "VidCoreNativePlayer"
WEB = ROOT / "VidCoreWebPlayer"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_regex(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Missing Defender-safe patch anchor: {label}")
    return updated


# Remove the native HTML scraper/downloader and filesystem-pruning module from
# the executable. WebView2 still keeps its profile and normal browser cache in
# data/ beside the executable.
cmake_path = NATIVE / "CMakeLists.txt"
cmake = read(cmake_path)
cmake = re.sub(r"^\s*src/vidcore\.image_cache\.ixx\s*$\n?", "", cmake, flags=re.M)
cmake = re.sub(r"^\s*winhttp\s*$\n?", "", cmake, flags=re.M)
write(cmake_path, cmake)

cache_module = NATIVE / "src" / "vidcore.image_cache.ixx"
if cache_module.exists():
    cache_module.unlink()

webview_path = NATIVE / "src" / "vidcore.webview.ixx"
webview = read(webview_path)
webview = webview.replace("#include <array>\n", "")
webview = webview.replace("import vidcore.image_cache;\n", "")
webview = replace_regex(
    webview,
    r'\n\s*if \(command == L"resolve-image"\) \{.*?\n\s*if \(command == L"mute"\) \{',
    '\n\n        if (command == L"mute") {',
    "native image command block",
    re.S,
)
webview = re.sub(r"^\s*ImageCache\s+image_cache_\{.*?\};\s*$\n?", "", webview, flags=re.M)
write(webview_path, webview)

# Keep the JS API stable but return immediately instead of waiting for an
# unsupported native downloader command.
app_path = NATIVE / "assets" / "app.js"
app = read(app_path)
app = replace_regex(
    app,
    r'  function requestNativeArtwork\(entry, metadata = entry\) \{.*?\n  \}\n\n  async function preferOfficialArtwork',
    '  function requestNativeArtwork(entry, metadata = entry) {\n'
    '    void entry;\n'
    '    void metadata;\n'
    '    return Promise.resolve("");\n'
    '  }\n\n'
    '  async function preferOfficialArtwork',
    "nonblocking artwork fallback",
    re.S,
)
app = replace_regex(
    app,
    r'  async function pruneNativeArtworkCache\(\) \{.*?\n  \}\n\n  function setStatus',
    '  async function pruneNativeArtworkCache() {\n'
    '    // WebView2 owns its browser cache under data/ beside the executable.\n'
    '  }\n\n'
    '  function setStatus',
    "browser cache fallback",
    re.S,
)
write(app_path, app)
shutil.copy2(app_path, WEB / "app.js")

# Remove tests that assert the retired WinHTTP module while preserving all UI,
# provider, backup, metadata filtering, and native host tests.
smoke_path = NATIVE / "tests" / "static-smoke.test.mjs"
smoke_lines = read(smoke_path).splitlines()
retired_markers = (
    "const imageCache = fs.readFileSync",
    "const cmake = fs.readFileSync",
    "assert.match(app, /resolve-image/)",
    "assert.match(app, /prune-image-cache/)",
    "assert.match(app, /delete-image-cache/)",
    "assert.match(webview, /ImageCache/)",
    "assert.match(webview, /image-resolved/)",
    "assert.match(imageCache, /media-imdb/)",
    "assert.match(imageCache, /v2\\\\.sg\\\\.media-imdb\\\\.com/)",
    "assert.match(imageCache, /themoviedb\\\\.org/)",
    "assert.match(imageCache, /WinHttpOpen/)",
    "assert.match(cmake, /vidcore\\\\.image_cache\\\\.ixx/)",
    "assert.match(cmake, /winhttp/)",
)
smoke = "\n".join(
    line for line in smoke_lines
    if not any(marker in line for marker in retired_markers)
) + "\n"
smoke += '\nassert.doesNotMatch(webview, /resolve-image|delete-image-cache|prune-image-cache/);\n'
smoke += 'assert.doesNotMatch(webview, /WinHttpOpen|ImageCache/);\n'
write(smoke_path, smoke)

readme_path = NATIVE / "README.md"
readme = read(readme_path)
readme = re.sub(
    r"\n## IMDb/TMDB artwork cache\n.*?(?=\n## |\Z)",
    "\n## Portable browser data\n\n"
    "The native executable does not contain a custom page scraper, native image downloader, or automatic image-file deletion code. WebView2 keeps its browser profile, HTTP cache, IndexedDB, localStorage, settings, and popup history under `data/` beside the executable. This keeps all runtime data portable without adding downloader behavior to the unsigned EXE.\n",
    readme,
    flags=re.S,
)
write(readme_path, readme)

mission_path = ROOT / "missioncache.md"
mission = read(mission_path)
for completed in [
    "- [x] Resolve artwork from IMDb title/media imagery first instead of using Wikipedia as the primary image source.\n",
    "- [x] Use TMDB title/backdrop imagery as the second official artwork source.\n",
    "- [x] Cache resolved native artwork in `cache/` beside the executable with readable media-based filenames.\n",
    "- [x] Reuse one cached image across VidCore, YTHD, and VidUp provider selections.\n",
    "- [x] Reuse cached artwork without repeating IMDb/TMDB requests while the title remains saved.\n",
    "- [x] Delete cached artwork when the final saved library copy is removed.\n",
    "- [x] Prune orphaned cache images at startup and after backup import.\n",
]:
    mission = mission.replace(completed, "")

security_done = (
    "- [x] Remove the native WinHTTP page scraper/downloader and automatic cache-file deletion from the shipping executable after a Windows Defender detection report.\n"
    "- [x] Keep WebView2 profile data and its normal browser cache under `data/` beside the executable.\n"
    "- [x] Add a Windows Defender scan report and a source-build ZIP to the release artifacts.\n"
)
if security_done not in mission:
    marker = "- [x] Publish release `v0.2.6` with the completed compact blue redesign and refreshed defaults.\n"
    mission = mission.replace(marker, marker + security_done)

open_items = (
    "- [ ] Restore IMDb-first/TMDB-second official artwork through a signed or independently verified implementation that does not trigger Defender.\n"
    "- [ ] Restore readable `cache/<media>.jpg` lifecycle only after the implementation passes Microsoft Defender analysis.\n"
    "- [ ] Add Authenticode signing or Microsoft Store distribution so new native binaries can build publisher reputation.\n"
)
if open_items not in mission:
    marker = "## Open / provider-limited\n\n"
    mission = mission.replace(marker, marker + open_items)
write(mission_path, mission)

print("Removed heuristic-heavy native downloader behavior and reopened the cache mission safely.")
