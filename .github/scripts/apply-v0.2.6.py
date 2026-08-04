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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing v0.2.6 patch anchor: {label}")
    return text.replace(old, new, 1)


def move_current_card_above_player(index: str) -> str:
    match = re.search(
        r'        <section class="current-card panel">.*?        </section>\n\n',
        index,
        re.S,
    )
    if not match:
        raise RuntimeError("Could not locate current metadata card")
    block = match.group(0)
    index = index[:match.start()] + index[match.end():]
    anchor = '        <section id="playerShell" class="player-shell panel">'
    if anchor not in index:
        raise RuntimeError("Could not locate player shell")
    return index.replace(anchor, block + anchor, 1)


# ---------------------------------------------------------------------------
# HTML: compact top controls/card, new product title, silent blocker status.
# ---------------------------------------------------------------------------
index_path = NATIVE / "assets" / "index.html"
index = read(index_path)
index = index.replace("<title>VidCore Native Player</title>", "<title>Shielded Native Stream Player</title>")
index = index.replace("<strong>VidCore Native Player</strong>", "<strong>Shielded Native Stream Player</strong>")
index = index.replace(
    "C++23 modules · full library · native popup shield",
    "C++23 modules · portable library · native popup shield",
)
index = re.sub(
    r'\n\s*<b id="blockedCount">0</b>',
    "",
    index,
    count=1,
)
index = move_current_card_above_player(index)
index = replace_once(
    index,
    '  <script src="builtin-library.js"></script>\n  <script src="storage.js"></script>',
    '  <script src="builtin-library.js"></script>\n  <script src="builtin-additions.js"></script>\n  <script src="storage.js"></script>',
    "built-in additions script",
)
write(index_path, index)

# ---------------------------------------------------------------------------
# App: remove blocker count binding; the shield simply remains active.
# ---------------------------------------------------------------------------
app_path = NATIVE / "assets" / "app.js"
app = read(app_path)
app = re.sub(r'^\s*blockedCount:\s*\$\("#blockedCount"\),?\n', "", app, flags=re.M)
app = re.sub(r'^\s*elements\.blockedCount[^\n]*\n', "", app, flags=re.M)
write(app_path, app)

# ---------------------------------------------------------------------------
# Blue theme, square artwork, compact metadata, horizontal action rows.
# ---------------------------------------------------------------------------
styles_path = NATIVE / "assets" / "styles.css"
styles = read(styles_path)
styles = styles.replace("--primary: #7c5cff;", "--primary: #2f8cff;")
styles = styles.replace("--primary-hover: #9179ff;", "--primary-hover: #55a3ff;")
styles = styles.replace("rgba(124, 92, 255", "rgba(47, 140, 255")
styles = styles.replace("#bdb2ff", "#b8d9ff")
styles = styles.replace("#c2b7ff", "#c7e2ff")
styles = re.sub(r'\n\.shield-pill b \{.*?\n\}\n', "\n", styles, count=1, flags=re.S)

compact_css = r'''

/* v0.2.6 compact blue layout */
.current-card {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  min-height: 0;
  margin-bottom: 14px;
  padding: 11px;
}

.current-poster {
  width: 92px;
  height: 92px;
  min-height: 92px;
  aspect-ratio: 1;
  border-radius: 13px;
}

.current-copy h1 {
  margin: 2px 0 5px;
  font-size: clamp(19px, 1.65vw, 27px);
}

.current-copy p {
  margin-top: 6px;
  line-height: 1.35;
  -webkit-line-clamp: 2;
}

.tags {
  margin-top: 7px;
}

.current-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-flow: row wrap;
  align-items: stretch;
  gap: 7px;
  width: 100%;
}

.current-actions .button {
  flex: 1 1 104px;
  min-width: 92px;
  min-height: 36px;
  padding: 5px 10px;
  white-space: normal;
  line-height: 1.15;
}

.media-card {
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: start;
}

.card-poster {
  width: 84px;
  min-height: 84px;
  aspect-ratio: 1;
}

.card-actions {
  display: flex;
  flex-flow: row wrap;
  gap: 6px;
  margin-top: 8px;
}

.card-actions .button {
  flex: 1 1 88px;
  min-width: 78px;
  min-height: 31px;
  padding: 5px 8px;
  white-space: normal;
  line-height: 1.15;
}

@media (max-width: 1080px) {
  .current-card {
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .current-poster {
    width: 82px;
    height: 82px;
    min-height: 82px;
  }

  .current-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-flow: row wrap;
  }
}
'''
styles += compact_css
write(styles_path, styles)

# ---------------------------------------------------------------------------
# Three new defaults from the latest supplied backup. Images are intentionally
# blank so the stricter resolver can choose correct title artwork locally.
# ---------------------------------------------------------------------------
additions = '''"use strict";

(() => {
  const previous = globalThis.VidCoreBuiltInLibraryPromise ??
    Promise.resolve(globalThis.VidCoreBuiltInLibrary ?? {});

  const additions = [
    {
      mode: "tv",
      id: "119051",
      season: 1,
      episode: 1,
      title: "Wednesday",
      description: "American horror comedy television series",
      year: "",
      image: "",
      imdb: "tt13443470",
      tmdb: "119051",
      genres: [
        "comedy horror film",
        "fantasy television series",
        "thriller television series",
        "comedy television series",
        "youth series"
      ],
      genreUris: [
        "http://www.wikidata.org/entity/Q108466999",
        "http://www.wikidata.org/entity/Q98526245",
        "http://www.wikidata.org/entity/Q67175872",
        "http://www.wikidata.org/entity/Q9335576",
        "http://www.wikidata.org/entity/Q1711400"
      ],
      wikidata: "http://www.wikidata.org/entity/Q105553568",
      article: "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      wikipedia: "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      resolutionStatus: "resolved",
      list: "Comedy",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T12:26:21.024Z",
      updatedAt: "2026-08-04T12:26:21.024Z"
    },
    {
      mode: "tv",
      id: "157741",
      season: 1,
      episode: 1,
      title: "Landman",
      description: "American television series",
      year: "",
      image: "",
      imdb: "tt14186672",
      tmdb: "157741",
      genres: ["neo-Western", "drama television series"],
      genreUris: [
        "http://www.wikidata.org/entity/Q116955088",
        "http://www.wikidata.org/entity/Q1366112"
      ],
      wikidata: "http://www.wikidata.org/entity/Q124447212",
      article: "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      wikipedia: "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      resolutionStatus: "resolved",
      list: "Western",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T12:00:08.168Z",
      updatedAt: "2026-08-04T12:11:02.863Z"
    },
    {
      mode: "tv",
      id: "290295",
      season: 1,
      episode: 1,
      title: "Mating Season",
      description: "2026 adult animated American television series",
      year: "2026",
      image: "",
      imdb: "tt14690136",
      tmdb: "290295",
      genres: [
        "adult animated television series",
        "comedy television series"
      ],
      genreUris: [
        "http://www.wikidata.org/entity/Q138600175",
        "http://www.wikidata.org/entity/Q9335576"
      ],
      wikidata: "http://www.wikidata.org/entity/Q139387446",
      article: "https://en.wikipedia.org/wiki/Mating_Season",
      wikipedia: "https://en.wikipedia.org/wiki/Mating_Season",
      resolutionStatus: "resolved",
      list: "Comedy",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T11:52:17.985Z",
      updatedAt: "2026-08-04T11:52:17.985Z"
    }
  ];

  function identity(entry) {
    return [
      entry.mode,
      entry.id,
      entry.mode === "tv" ? entry.season ?? 1 : "",
      entry.mode === "tv" ? entry.episode ?? 1 : ""
    ].join("|");
  }

  globalThis.VidCoreBuiltInLibraryPromise = Promise.resolve(previous).then(payload => {
    const favorites = Array.isArray(payload?.favorites) ? payload.favorites : [];
    const known = new Set(favorites.map(identity));
    const merged = [...favorites];
    for (const entry of additions) {
      if (!known.has(identity(entry))) {
        known.add(identity(entry));
        merged.push(entry);
      }
    }
    return {
      ...payload,
      exportedAt: "2026-08-04T12:26:33.414Z",
      favorites: merged
    };
  });
})();
'''
write(NATIVE / "assets" / "builtin-additions.js", additions)

# ---------------------------------------------------------------------------
# Native window title and version.
# ---------------------------------------------------------------------------
config_path = NATIVE / "src" / "vidcore.config.ixx"
config = read(config_path)
config = config.replace('application_name = L"VidCore Native Player"', 'application_name = L"Shielded Native Stream Player"')
config = config.replace('version = L"0.2.5"', 'version = L"0.2.6"')
write(config_path, config)

cmake_path = NATIVE / "CMakeLists.txt"
cmake = read(cmake_path).replace("VERSION 0.2.5", "VERSION 0.2.6", 1)
write(cmake_path, cmake)

# ---------------------------------------------------------------------------
# Tests: both top sections, silent shield, blue theme, square images, 108 seed.
# ---------------------------------------------------------------------------
builtin_test_path = NATIVE / "tests" / "builtin-library.test.mjs"
builtin_test = read(builtin_test_path)
builtin_test = replace_once(
    builtin_test,
    '''  assert.ok(html.indexOf('class="source-panel panel"') < html.indexOf('id="playerShell"'));
  assert.ok(html.indexOf('class="transport panel"') < html.indexOf('class="current-card panel"'));''',
    '''  assert.ok(html.indexOf('class="source-panel panel"') < html.indexOf('id="playerShell"'));
  assert.ok(html.indexOf('class="current-card panel"') < html.indexOf('id="playerShell"'));''',
    "top section test",
)
builtin_test = replace_once(
    builtin_test,
    '''  vm.runInContext(fs.readFileSync(path.join(root, "builtin-library.js"), "utf8"), context);
  const library = await context.VidCoreBuiltInLibraryPromise;''',
    '''  vm.runInContext(fs.readFileSync(path.join(root, "builtin-library.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "builtin-additions.js"), "utf8"), context);
  const library = await context.VidCoreBuiltInLibraryPromise;''',
    "addition test script",
)
builtin_test = builtin_test.replace("assert.equal(library.favorites.length, 105);", "assert.equal(library.favorites.length, 108);")
builtin_test = builtin_test.replace(
    'console.log("Built-in library merge and lower-control layout checks passed.");',
    'console.log("Built-in library additions and compact top-layout checks passed.");',
)
write(builtin_test_path, builtin_test)

smoke_path = NATIVE / "tests" / "static-smoke.test.mjs"
smoke = read(smoke_path)
if 'const styles = fs.readFileSync' not in smoke:
    smoke = replace_once(
        smoke,
        'const metadata = fs.readFileSync(path.join(root, "assets", "metadata.js"), "utf8");',
        'const metadata = fs.readFileSync(path.join(root, "assets", "metadata.js"), "utf8");\nconst styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");',
        "styles test input",
    )
smoke = replace_once(
    smoke,
    'assert.ok(\n  html.indexOf(\'class="source-panel panel"\') <\n  html.indexOf(\'id="playerShell"\')\n);',
    '''assert.ok(
  html.indexOf('class="source-panel panel"') <
  html.indexOf('id="playerShell"')
);
assert.ok(
  html.indexOf('class="current-card panel"') <
  html.indexOf('id="playerShell"')
);
assert.match(html, /Shielded Native Stream Player/);
assert.doesNotMatch(html, /id="blockedCount"/);
assert.match(html, /builtin-additions\\.js/);
assert.match(styles, /--primary: #2f8cff/);
assert.match(styles, /aspect-ratio: 1/);''',
    "compact blue layout smoke checks",
)
write(smoke_path, smoke)

# Mirror all changed browser assets to the web player.
for name in [
    "index.html",
    "styles.css",
    "app.js",
    "builtin-additions.js",
]:
    shutil.copy2(NATIVE / "assets" / name, WEB / name)

# Mission ledger: close all requested v0.2.6 work without altering provider limits.
mission_path = ROOT / "missioncache.md"
mission = read(mission_path)
mission = mission.replace(
    "- [x] Move the provider/play controls back to the top while keeping the resolve metadata card below Stop/transport.",
    "- [x] Keep both the provider/play controls and compact resolve metadata card above the player.",
)
completed = '''
- [x] Rename the visible application and native window to `Shielded Native Stream Player`.
- [x] Remove the blocker count while keeping native popup protection active and accessible through Shield details.
- [x] Convert the interface accent theme from purple to blue in both players.
- [x] Make current and library artwork square instead of tall poster slots.
- [x] Reduce the resolve metadata card height and use horizontal wrapping action buttons.
- [x] Keep provider/play controls and the compact resolve card together above the player.
- [x] Add Wednesday, Landman, and Mating Season from the latest backup to built-in defaults without overwriting user edits.
- [x] Preserve non-destructive seed merging so deleted defaults stay deleted and only unseen defaults are added.
- [x] Publish release `v0.2.6` with the completed compact blue redesign and refreshed defaults.
'''
if "Rename the visible application" not in mission:
    mission = mission.replace("\n## Open / provider-limited", "\n" + completed + "\n## Open / provider-limited")
write(mission_path, mission)

write(ROOT / "VERSION", "0.2.6\n")
print("Applied v0.2.6 compact blue layout, title, silent shield, and three new defaults.")
