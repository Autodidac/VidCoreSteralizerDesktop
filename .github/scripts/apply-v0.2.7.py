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
    if text.count(old) != 1:
        raise RuntimeError(f"Expected one {label} anchor, found {text.count(old)}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one {label} regex match, found {count}")
    return updated


# Swap the two top sections and add list deletion to both UI variants.
html_path = NATIVE / "assets" / "index.html"
html = read(html_path)
html = regex_once(
    html,
    r'(?P<source>        <section class="source-panel panel">.*?        </section>\n\n)'
    r'(?P<card>        <section class="current-card panel">.*?        </section>\n\n)',
    r'\g<card>\g<source>',
    "top card/provider section order",
)
html = replace_once(
    html,
    '''            <div class="tool-row">
              <button id="resolveListButton" class="button">Resolve list</button>
              <button id="markListWatchedButton" class="button">Mark watched</button>
            </div>''',
    '''            <div class="tool-row">
              <button id="resolveListButton" class="button">Resolve list</button>
              <button id="markListWatchedButton" class="button">Mark watched</button>
              <button id="deleteListButton" class="button danger hidden">Delete list</button>
            </div>''',
    "delete-list button",
)
write(html_path, html)
shutil.copy2(html_path, WEB / "index.html")


# Add safe list deletion, preserve titles by moving them to Favorites, and
# prune empty custom list records after they are no longer selected.
app_path = NATIVE / "assets" / "app.js"
app = read(app_path)
app = replace_once(
    app,
    '    markListWatchedButton: $("#markListWatchedButton"),\n',
    '    markListWatchedButton: $("#markListWatchedButton"),\n'
    '    deleteListButton: $("#deleteListButton"),\n',
    "delete-list element",
)

new_render_lists = '''  async function renderListControls() {
    if (!state.storageReady) return;

    let { lists, favorites } = await listData();
    const customCount = name =>
      favorites.filter(entry => entry.list === name).length;

    // Empty custom lists disappear once they are no longer the actively
    // selected newly-created list. This keeps the list bar free of dead labels
    // without making a fresh list vanish before the user can put an item in it.
    const staleEmptyLists = lists.filter(list =>
      list.name !== "Favorites" &&
      list.name !== state.selectedList &&
      customCount(list.name) === 0
    );
    for (const list of staleEmptyLists) {
      await VidCoreStorage.remove(VidCoreStorage.STORES.lists, list.name);
    }
    if (staleEmptyLists.length) {
      lists = lists.filter(list => !staleEmptyLists.some(stale => stale.name === list.name));
    }

    const customNames = lists
      .map(list => list.name)
      .filter(name => name !== "Favorites")
      .filter(name => customCount(name) > 0 || name === state.selectedList);
    const names = ["All", "Favorites", ...customNames];

    if (!names.includes(state.selectedList)) {
      state.selectedList = "All";
    }

    elements.listChips.replaceChildren();

    for (const name of names) {
      const count = name === "All"
        ? favorites.length
        : favorites.filter(entry => entry.list === name).length;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "list-chip";
      chip.classList.toggle("active", name === state.selectedList);
      chip.textContent = `${name} ${count}`;
      chip.addEventListener("click", () => {
        state.selectedList = name;
        renderListControls();
        renderLibrary();
      });
      elements.listChips.append(chip);
    }

    const customSelected = state.selectedList !== "All" &&
      state.selectedList !== "Favorites" &&
      lists.some(list => list.name === state.selectedList);
    elements.deleteListButton.classList.toggle("hidden", !customSelected);
    elements.deleteListButton.disabled = !customSelected;

    elements.saveList.replaceChildren();
    const orderedLists = [
      ...lists.filter(list => list.name === "Favorites"),
      ...lists.filter(list => list.name !== "Favorites")
    ];
    for (const list of orderedLists) {
      const option = document.createElement("option");
      option.value = list.name;
      option.textContent = list.name;
      elements.saveList.append(option);
    }
  }
'''
app = regex_once(
    app,
    r'  async function renderListControls\(\) \{.*?\n  \}\n\n  function filterLibraryEntries',
    new_render_lists + '\n  function filterLibraryEntries',
    "renderListControls function",
)

new_delete_function = '''  async function deleteSelectedList() {
    const name = state.selectedList;
    if (!name || name === "All" || name === "Favorites") {
      setStatus("Choose a custom list", "All and Favorites cannot be deleted.", "warn");
      return;
    }

    const favorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    const members = favorites.filter(entry => entry.list === name);
    const moveNote = members.length
      ? ` ${members.length} saved title${members.length === 1 ? "" : "s"} will move to Favorites.`
      : "";
    if (!globalThis.confirm(`Delete list “${name}”?${moveNote}`)) return;

    const updatedAt = new Date().toISOString();
    for (const entry of members) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.favorites,
        { ...entry, list: "Favorites", updatedAt }
      );
    }
    await VidCoreStorage.remove(VidCoreStorage.STORES.lists, name);

    state.selectedList = "All";
    await renderAllLibraryViews();
    setStatus(
      "List deleted",
      members.length
        ? `${name}; moved ${members.length} title${members.length === 1 ? "" : "s"} to Favorites.`
        : name,
      "ok"
    );
  }

'''
app = replace_once(
    app,
    '  async function selectedFavorites() {\n',
    new_delete_function + '  async function selectedFavorites() {\n',
    "deleteSelectedList insertion",
)
app = replace_once(
    app,
    '''    elements.markListWatchedButton.addEventListener(
      "click",
      markSelectedListWatched
    );''',
    '''    elements.markListWatchedButton.addEventListener(
      "click",
      markSelectedListWatched
    );
    elements.deleteListButton.addEventListener(
      "click",
      deleteSelectedList
    );''',
    "delete-list event",
)
write(app_path, app)
shutil.copy2(app_path, WEB / "app.js")


# Strengthen static validation for ordering, deletion behavior, and all 108
# defaults represented by the 105-title base plus the three supplied additions.
test_path = NATIVE / "tests" / "static-smoke.test.mjs"
test = read(test_path)
test = replace_once(
    test,
    'const styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");\n',
    'const styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");\n'
    'const additions = fs.readFileSync(path.join(root, "assets", "builtin-additions.js"), "utf8");\n',
    "additions fixture",
)
test = replace_once(
    test,
    '  "movies123Button"\n]) {',
    '  "movies123Button",\n  "deleteListButton"\n]) {',
    "delete-list test id",
)
test = replace_once(
    test,
    '''assert.ok(
  html.indexOf('class="source-panel panel"') <
  html.indexOf('id="playerShell"')
);
assert.ok(
  html.indexOf('class="current-card panel"') <
  html.indexOf('id="playerShell"')
);''',
    '''assert.ok(
  html.indexOf('class="current-card panel"') <
  html.indexOf('class="source-panel panel"')
);
assert.ok(
  html.indexOf('class="source-panel panel"') <
  html.indexOf('id="playerShell"')
);''',
    "top-section ordering assertions",
)
test = replace_once(
    test,
    'assert.match(styles, /aspect-ratio: 1/);\n',
    'assert.match(styles, /aspect-ratio: 1/);\n'
    'assert.match(app, /async function deleteSelectedList/);\n'
    'assert.match(app, /VidCoreStorage\\.remove\\(VidCoreStorage\\.STORES\\.lists, name\\)/);\n'
    'assert.match(app, /list: "Favorites"/);\n'
    'assert.match(app, /staleEmptyLists/);\n'
    'for (const title of ["Wednesday", "Landman", "Mating Season"]) {\n'
    '  assert.match(additions, new RegExp(`title: "${title}"`));\n'
    '}\n',
    "list and default assertions",
)
write(test_path, test)


# Version and release ledger.
cmake_path = NATIVE / "CMakeLists.txt"
cmake = replace_once(read(cmake_path), "VERSION 0.2.6", "VERSION 0.2.7", "CMake version")
write(cmake_path, cmake)

mission_path = ROOT / "missioncache.md"
mission = read(mission_path)
completed = '''- [x] Put the compact resolve metadata card above the provider/play controls in both players.
- [x] Add an explicit custom-list delete action that preserves saved titles by moving them to Favorites.
- [x] Hide empty custom lists and prune empty list records after they are no longer selected.
- [x] Reconcile the latest supplied backup so all 108 built-in default titles remain included without overwriting user edits.
- [x] Publish release `v0.2.7` with the swapped top sections and list management cleanup.

'''
if completed not in mission:
    mission = mission.replace("## Open / provider-limited\n", completed + "## Open / provider-limited\n", 1)
write(mission_path, mission)

print("Staged v0.2.7: card above provider controls, safe list deletion, empty-list cleanup, and 108 default-title validation.")
