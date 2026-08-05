from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEW_EXPORTED_AT = "2026-08-05T14:12:00.000Z"

APP_FILES = [
    "VidCoreNativePlayer/assets/app.js",
    "VidCoreWebPlayer/app.js",
]
HTML_FILES = [
    "VidCoreNativePlayer/assets/index.html",
    "VidCoreWebPlayer/index.html",
]
ADDITION_FILES = [
    "VidCoreNativePlayer/assets/builtin-additions.js",
    "VidCoreWebPlayer/builtin-additions.js",
]

INDIANA_JONES = [
    {
        "mode": "movie",
        "id": "85",
        "title": "Raiders of the Lost Ark",
        "description": "1981 action-adventure film",
        "year": "1981",
        "image": "",
        "imdb": "tt0082971",
        "tmdb": "85",
        "genres": ["action film", "adventure film"],
        "genreUris": [],
        "wikidata": "",
        "article": "",
        "wikipedia": "",
        "resolutionStatus": "unresolved",
        "list": "Action",
        "notes": "",
        "watched": False,
        "createdAt": NEW_EXPORTED_AT,
        "updatedAt": NEW_EXPORTED_AT,
    },
    {
        "mode": "movie",
        "id": "87",
        "title": "Indiana Jones and the Temple of Doom",
        "description": "1984 action-adventure film",
        "year": "1984",
        "image": "",
        "imdb": "tt0087469",
        "tmdb": "87",
        "genres": ["action film", "adventure film"],
        "genreUris": [],
        "wikidata": "",
        "article": "",
        "wikipedia": "",
        "resolutionStatus": "unresolved",
        "list": "Action",
        "notes": "",
        "watched": False,
        "createdAt": NEW_EXPORTED_AT,
        "updatedAt": NEW_EXPORTED_AT,
    },
    {
        "mode": "movie",
        "id": "89",
        "title": "Indiana Jones and the Last Crusade",
        "description": "1989 action-adventure film",
        "year": "1989",
        "image": "",
        "imdb": "tt0097576",
        "tmdb": "89",
        "genres": ["action film", "adventure film"],
        "genreUris": [],
        "wikidata": "",
        "article": "",
        "wikipedia": "",
        "resolutionStatus": "unresolved",
        "list": "Action",
        "notes": "",
        "watched": False,
        "createdAt": NEW_EXPORTED_AT,
        "updatedAt": NEW_EXPORTED_AT,
    },
    {
        "mode": "movie",
        "id": "217",
        "title": "Indiana Jones and the Kingdom of the Crystal Skull",
        "description": "2008 action-adventure film",
        "year": "2008",
        "image": "",
        "imdb": "tt0367882",
        "tmdb": "217",
        "genres": ["action film", "adventure film"],
        "genreUris": [],
        "wikidata": "",
        "article": "",
        "wikipedia": "",
        "resolutionStatus": "unresolved",
        "list": "Action",
        "notes": "",
        "watched": False,
        "createdAt": NEW_EXPORTED_AT,
        "updatedAt": NEW_EXPORTED_AT,
    },
    {
        "mode": "movie",
        "id": "335977",
        "title": "Indiana Jones and the Dial of Destiny",
        "description": "2023 action-adventure film",
        "year": "2023",
        "image": "",
        "imdb": "tt1462764",
        "tmdb": "335977",
        "genres": ["action film", "adventure film"],
        "genreUris": [],
        "wikidata": "",
        "article": "",
        "wikipedia": "",
        "resolutionStatus": "unresolved",
        "list": "Action",
        "notes": "",
        "watched": False,
        "createdAt": NEW_EXPORTED_AT,
        "updatedAt": NEW_EXPORTED_AT,
    },
]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, text: str) -> None:
    (ROOT / relative).write_text(text, encoding="utf-8")


def replace_once(relative: str, old: str, new: str) -> None:
    text = read(relative)
    if old not in text:
        raise RuntimeError(f"Expected text was not found in {relative}: {old[:120]!r}")
    write(relative, text.replace(old, new, 1))


def replace_regex_once(
    relative: str,
    pattern: str,
    replacement: str,
    flags: int = re.DOTALL,
) -> None:
    text = read(relative)
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(
            f"Expected pattern was not found exactly once in {relative}: {pattern!r}"
        )
    write(relative, updated)


def identity(entry: dict[str, object]) -> tuple[object, ...]:
    mode = str(entry.get("mode", ""))
    return (
        mode,
        str(entry.get("id", "")),
        entry.get("season", 1) if mode == "tv" else "",
        entry.get("episode", 1) if mode == "tv" else "",
    )


def update_additions(relative: str) -> None:
    text = read(relative)
    pattern = re.compile(
        r"  const additions = (\[.*?\]);\n\n  const listAdditions",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Could not locate additions array in {relative}")

    additions = json.loads(match.group(1))
    known = {identity(entry) for entry in additions}
    for entry in INDIANA_JONES:
        key = identity(entry)
        if key not in known:
            additions.append(entry)
            known.add(key)

    encoded = json.dumps(additions, indent=2, ensure_ascii=False)
    rendered = "\n".join("  " + line for line in encoded.splitlines())
    replacement = f"  const additions = {rendered.lstrip()};\n\n  const listAdditions"
    text = text[: match.start()] + replacement + text[match.end() :]
    text, count = re.subn(
        r'exportedAt: "[^"]+"',
        f'exportedAt: "{NEW_EXPORTED_AT}"',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"Could not update exportedAt in {relative}")
    write(relative, text)


for relative in APP_FILES:
    replace_once(
        relative,
        '    newListName: $("#newListName"),\n    addListButton: $("#addListButton"),\n',
        '    saveNewListName: $("#saveNewListName"),\n'
        '    saveAddListButton: $("#saveAddListButton"),\n',
    )

    replace_regex_once(
        relative,
        r"  async function renderListControls\(\) \{.*?\n  \}\n\n  function filterLibraryEntries",
        '''  async function renderListControls() {
    if (!state.storageReady) return;

    const { lists, favorites } = await listData();
    const customCount = name =>
      favorites.filter(entry => categoryForEntry(entry) === name).length;

    const storedNames = lists
      .map(list => list.name)
      .filter(name => name !== "Favorites");
    const entryNames = favorites.map(categoryForEntry);
    const customNames = [...new Set([...storedNames, ...entryNames])]
      .sort((left, right) => left.localeCompare(right));
    const names = ["All", "Favorites", ...customNames];

    if (!names.includes(state.selectedList)) state.selectedList = "All";
    elements.listChips.replaceChildren();

    for (const name of names) {
      const count = name === "All"
        ? favorites.length
        : name === "Favorites"
          ? favorites.filter(isFavoriteEntry).length
          : customCount(name);
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

    const previousSelection = elements.saveList.value;
    elements.saveList.replaceChildren();
    const saveCategories = customNames.includes("Uncategorized")
      ? customNames
      : [...customNames, "Uncategorized"];
    for (const name of saveCategories) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.saveList.append(option);
    }
    if (saveCategories.includes(previousSelection)) {
      elements.saveList.value = previousSelection;
    }
  }

  function filterLibraryEntries''',
    )

    replace_once(
        relative,
        '''    elements.saveWatched.checked = Boolean(existing?.watched);
    elements.saveDialog.showModal();
''',
        '''    elements.saveWatched.checked = Boolean(existing?.watched);
    elements.saveNewListName.value = "";
    elements.saveDialog.showModal();
''',
    )

    replace_once(
        relative,
        '''    const now = new Date().toISOString();

    await VidCoreStorage.put(
''',
        '''    const now = new Date().toISOString();
    const destinationList = elements.saveList.value || "Uncategorized";

    await VidCoreStorage.put(
''',
    )
    replace_once(
        relative,
        '        list: elements.saveList.value || "Uncategorized",\n',
        '        list: destinationList,\n',
    )
    replace_once(
        relative,
        '''    elements.saveDialog.close();
    state.dialogEntry = null;
    state.editingKey = "";
    await renderAllLibraryViews();
    setStatus("Library updated", "The title was saved.", "ok");
''',
        '''    elements.saveDialog.close();
    state.dialogEntry = null;
    state.editingKey = "";
    state.selectedList = destinationList;
    showPanel("library");
    await renderAllLibraryViews();
    setStatus("Library updated", `Saved to ${destinationList}.`, "ok");
''',
    )

    replace_regex_once(
        relative,
        r"  async function addList\(\) \{.*?\n  \}\n\n  async function deleteSelectedList",
        '''  async function createList(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      setStatus("List name required", "Enter a name first.", "warn");
      return "";
    }

    if (RESERVED_LISTS.has(trimmed.toLocaleLowerCase())) {
      setStatus(
        "Reserved list name",
        "Choose a name other than All, Favorites, Continue, Recommended, Related, or Blocked.",
        "warn"
      );
      return "";
    }

    const lists = await VidCoreStorage.getAll(VidCoreStorage.STORES.lists);
    const existing = lists.find(
      list => list.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
    );
    if (existing) return existing.name;

    await VidCoreStorage.put(
      VidCoreStorage.STORES.lists,
      {
        name: trimmed,
        createdAt: new Date().toISOString()
      }
    );
    return trimmed;
  }

  async function addListFromDialog() {
    const name = await createList(elements.saveNewListName.value);
    if (!name) return;

    elements.saveNewListName.value = "";
    await renderListControls();
    elements.saveList.value = name;
    setStatus("List ready", `${name} is selected for this title.`, "ok");
  }

  async function deleteSelectedList''',
    )

    replace_once(
        relative,
        '''    elements.addListButton.addEventListener("click", addList);
    elements.newListName.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        addList();
      }
    });
''',
        '''    elements.saveAddListButton.addEventListener("click", () => {
      addListFromDialog().catch(error =>
        setStatus("List creation failed", error.message, "error")
      );
    });
    elements.saveNewListName.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addListFromDialog().catch(error =>
          setStatus("List creation failed", error.message, "error")
        );
      }
    });
''',
    )

for relative in HTML_FILES:
    replace_once(
        relative,
        '''            <div class="tool-row">
              <input
                  id="newListName"
                  placeholder="New list name"
                  maxlength="40">
              <button id="addListButton" class="button">Add list</button>
            </div>

''',
        "",
    )
    replace_once(
        relative,
        '''      <label class="field">
        <span>List</span>
        <select id="saveList"></select>
      </label>

''',
        '''      <label class="field">
        <span>List</span>
        <select id="saveList"></select>
      </label>

      <div class="tool-row">
        <input
            id="saveNewListName"
            placeholder="Create a new list"
            maxlength="40">
        <button id="saveAddListButton" class="button" type="button">
          Create list
        </button>
      </div>

''',
    )
    replace_once(
        relative,
        "Favorites are an overlay and no longer replace a title's category. Favorites, lists, notes, watched state, Continue Watching, and history use IndexedDB when available.",
        "Favorites are an overlay and no longer replace a title's category. Create lists directly inside Edit/Save; empty lists persist until you explicitly delete them, and saving switches Library to the destination list. Favorites, lists, notes, watched state, Continue Watching, and history use IndexedDB when available.",
    )

for relative in ADDITION_FILES:
    update_additions(relative)

for native, web in [
    ("VidCoreNativePlayer/assets/app.js", "VidCoreWebPlayer/app.js"),
    ("VidCoreNativePlayer/assets/index.html", "VidCoreWebPlayer/index.html"),
    ("VidCoreNativePlayer/assets/builtin-additions.js", "VidCoreWebPlayer/builtin-additions.js"),
]:
    if read(native) != read(web):
        raise RuntimeError(f"Native and Web files diverged: {native} != {web}")

static_test = "VidCoreNativePlayer/tests/static-smoke.test.mjs"
replace_once(
    static_test,
    '''  "deleteListButton",
  "saveFavorite"
''',
    '''  "deleteListButton",
  "saveFavorite",
  "saveNewListName",
  "saveAddListButton"
''',
)
replace_once(
    static_test,
    "assert.match(app, /staleEmptyLists/);\n",
    '''assert.doesNotMatch(app, /staleEmptyLists/);
assert.match(app, /async function addListFromDialog/);
assert.match(app, /state\\.selectedList = destinationList/);
assert.match(app, /showPanel\\(\"library\"\\)/);
''',
)
replace_once(
    static_test,
    '''  "TV 319179 · S1 E1"
]) {
''',
    '''  "TV 319179 · S1 E1",
  "Raiders of the Lost Ark",
  "Indiana Jones and the Temple of Doom",
  "Indiana Jones and the Last Crusade",
  "Indiana Jones and the Kingdom of the Crystal Skull",
  "Indiana Jones and the Dial of Destiny"
]) {
''',
)

builtin_test = "VidCoreNativePlayer/tests/builtin-library.test.mjs"
replace_once(
    builtin_test,
    "  assert.equal(library.favorites.length, 114);\n",
    "  assert.equal(library.favorites.length, 119);\n",
)
replace_once(
    builtin_test,
    '''    "TV 319179 · S1 E1"
  ]) {
''',
    '''    "TV 319179 · S1 E1",
    "Raiders of the Lost Ark",
    "Indiana Jones and the Temple of Doom",
    "Indiana Jones and the Last Crusade",
    "Indiana Jones and the Kingdom of the Crystal Skull",
    "Indiana Jones and the Dial of Destiny"
  ]) {
''',
)
replace_once(
    builtin_test,
    '''  assert.ok(library.lists.some(list => list.name === "Fantasy"));
}
''',
    '''  assert.ok(library.lists.some(list => list.name === "Fantasy"));
  const indianaJones = library.favorites.filter(entry =>
    entry.title === "Raiders of the Lost Ark" ||
    entry.title.startsWith("Indiana Jones")
  );
  assert.equal(indianaJones.length, 5);
  assert.ok(indianaJones.every(entry => entry.list === "Action"));
}
''',
)

replace_once(
    "VidCoreNativePlayer/CMakeLists.txt",
    "    VERSION 0.2.14\n",
    "    VERSION 0.2.15\n",
)
replace_once(
    "AGENTS.md",
    "- Empty custom lists are hidden and pruned after they are no longer selected.\n",
    "- Empty custom lists persist until the user explicitly deletes them.\n"
    "- Custom lists are created inside Edit/Save and saving switches Library to the destination list.\n",
)
replace_once(
    "AGENTS.md",
    "- 114 provider-aware saved entries.\n",
    "- 119 provider-aware saved entries.\n",
)
replace_once(
    ".github/workflows/release.yml",
    "114 provider-aware built-in entries across 25 lists",
    "119 provider-aware built-in entries across 25 lists",
)

for relative in ["README.md", "VidCoreNativePlayer/README.md"]:
    text = read(relative)
    section = '''\n\n## v0.2.15 list durability and Action defaults\n\n- Custom list creation now lives inside Edit/Save.\n- Empty custom lists persist until explicitly deleted.\n- Saving a title switches Library to its destination list without deleting the list or item.\n- Raiders of the Lost Ark and all four Indiana Jones sequels are included in Action defaults.\n- The supplied standalone IMDb resolver was reviewed, but its WinHTTP downloader and hidden page automation remain excluded from the shipping player under the Defender-safe boundary.\n'''
    if "## v0.2.15 list durability and Action defaults" not in text:
        write(relative, text.rstrip() + section + "\n")

mission = read("missioncache.md")
completed = '''- [x] Move custom list creation into Edit/Save and immediately select the new list for the current title.
- [x] Keep empty custom lists until the user explicitly deletes them.
- [x] After Save, switch Library to the destination list without deleting the list or saved title.
- [x] Add Raiders of the Lost Ark and the four Indiana Jones sequels to the Action defaults.
- [x] Review the supplied C++23 IMDb resolver and preserve the Defender-safe shipping boundary by excluding its WinHTTP downloader and hidden page automation.
- [x] Stage v0.2.15 with synchronized Native/Web behavior, 119 built-in entries, tests, and release metadata.
'''
open_anchor = "## Open / provider-limited\n\n"
if completed.splitlines()[0] not in mission:
    if open_anchor not in mission:
        raise RuntimeError("Mission cache open section was not found")
    mission = mission.replace(open_anchor, completed + "\n" + open_anchor, 1)
mission = mission.replace(
    "Verify the downloadable v0.2.14 Windows artifact",
    "Verify the downloadable v0.2.15 Windows artifact",
)
write("missioncache.md", mission)

review_path = ROOT / "docs" / "IMDbPosterResolverReview.md"
review_path.parent.mkdir(parents=True, exist_ok=True)
review_path.write_text(
    '''# IMDbPosterResolver C++23 review\n\nThe supplied standalone resolver was reviewed for v0.2.15. Its strongest reusable idea is identity-first poster selection: anchor on IMDb's rendered hero-poster media key, collect JSON-LD and rendered-image candidates, reject candidates with a different media identity, then prefer the largest exact variant.\n\nThe sample also contains hidden WebView2 page automation and a custom WinHTTP image downloader. Those parts are intentionally not linked into or invoked by the shipping player because they recreate the network behavior removed after the real-user Microsoft Defender detection. The shipping executable remains on the v0.2.10+ Defender-safe profile.\n\nA future IMDb/TMDB multi-poster implementation must remain independently verified or signed, preserve explicit user control, and pass both CI and affected-user endpoint checks before release.\n''',
    encoding="utf-8",
)
