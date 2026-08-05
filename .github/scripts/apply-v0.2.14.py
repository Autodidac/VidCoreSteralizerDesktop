from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, text: str) -> None:
    (ROOT / relative).write_text(text, encoding="utf-8")


def replace_once(relative: str, old: str, new: str) -> None:
    text = read(relative)
    if old not in text:
        raise RuntimeError(f"Expected text was not found in {relative}: {old[:100]!r}")
    write(relative, text.replace(old, new, 1))


def replace_regex_once(relative: str, pattern: str, replacement: str, flags: int = re.DOTALL) -> None:
    text = read(relative)
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected pattern was not found exactly once in {relative}: {pattern!r}")
    write(relative, updated)


APP_FILES = [
    "VidCoreNativePlayer/assets/app.js",
    "VidCoreWebPlayer/app.js",
]
METADATA_FILES = [
    "VidCoreNativePlayer/assets/metadata.js",
    "VidCoreWebPlayer/metadata.js",
]
STORAGE_FILES = [
    "VidCoreNativePlayer/assets/storage.js",
    "VidCoreWebPlayer/storage.js",
]
HTML_FILES = [
    "VidCoreNativePlayer/assets/index.html",
    "VidCoreWebPlayer/index.html",
]

for relative in APP_FILES:
    replace_once(
        relative,
        '    saveWatched: $("#saveWatched"),\n',
        '    saveFavorite: $("#saveFavorite"),\n    saveWatched: $("#saveWatched"),\n',
    )
    replace_once(
        relative,
        '    related: [],\n    activePanel: "library",\n',
        '    related: [],\n    relatedLoading: false,\n    activePanel: "library",\n',
    )
    replace_once(
        relative,
        '    artworkSequence: 0,\n    artworkRequests: new Map()\n',
        '    artworkSequence: 0,\n    artworkRequests: new Map(),\n    localArtworkCache: new Map()\n',
    )

    replace_regex_once(
        relative,
        r'  function requestNativeArtwork\(entry, metadata = entry\) \{.*?\n  async function pruneNativeArtworkCache\(\) \{.*?\n  \}\n',
        '''  function isFavoriteEntry(entry) {
    return Boolean(entry?.favorite || entry?.list === "Favorites");
  }

  function categoryForEntry(entry) {
    const value = String(entry?.list || "").trim();
    return value && value !== "Favorites" ? value : "Uncategorized";
  }

  function hostField(value) {
    return encodeURIComponent(String(value || ""));
  }

  function requestNativeArtwork(entry, metadata = entry) {
    if (!globalThis.chrome?.webview) return Promise.resolve("");
    if (!entry?.list && !metadata?.list &&
        entry?.favorite === undefined && metadata?.favorite === undefined) {
      return Promise.resolve("");
    }

    const combined = { ...entry, ...metadata };
    const category = categoryForEntry(combined);
    const favorite = isFavoriteEntry(combined);
    const identity = mediaCacheIdentity(entry, metadata);
    const title = metadata?.title || entry?.title || VidCoreMetadata.fallbackTitle(entry);
    const cacheKey = `${category}|${favorite ? 1 : 0}|${identity}`;
    if (state.localArtworkCache.has(cacheKey)) {
      return state.localArtworkCache.get(cacheKey);
    }

    const requestId = `local-${++state.artworkSequence}`;
    const request = new Promise(resolve => {
      const timer = setTimeout(() => {
        state.artworkRequests.delete(requestId);
        resolve("");
      }, 2500);
      state.artworkRequests.set(requestId, { resolve, timer });
      postHost([
        "local-artwork",
        requestId,
        hostField(category),
        hostField(identity),
        hostField(title),
        favorite ? "1" : "0"
      ].join("|"));
    });
    state.localArtworkCache.set(cacheKey, request);
    return request;
  }

  async function preferOfficialArtwork(entry, metadata) {
    void entry;
    return metadata;
  }

  async function pruneNativeArtworkCache() {
    // User-owned data/artwork files are never downloaded, deleted, or pruned.
  }
'''
    )

    replace_once(
        relative,
        '''  function renderCurrent(entry, metadata) {
''',
        '''  function setEntryPoster(container, entry, metadata, fallback, guard = () => true) {
    const remoteImage = VidCoreMetadata.isLikelyBadArtwork(entry, metadata, metadata.image)
      ? ""
      : metadata.image;
    setPoster(container, remoteImage, fallback);
    requestNativeArtwork(entry, metadata).then(image => {
      if (image && guard()) setPoster(container, image, fallback);
    }).catch(() => {});
  }

  function renderCurrent(entry, metadata) {
'''
    )
    replace_once(
        relative,
        '''    setPoster(
      elements.currentPoster,
      VidCoreMetadata.isLikelyBadArtwork(entry, metadata, metadata.image)
        ? ""
        : metadata.image,
      entry.mode === "movie" ? "M" : "TV"
    );
''',
        '''    setEntryPoster(
      elements.currentPoster,
      entry,
      metadata,
      entry.mode === "movie" ? "M" : "TV",
      () => isCurrentEntry(entry)
    );
'''
    )
    replace_once(
        relative,
        '''    setPoster(
      poster,
      VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)
        ? ""
        : entry.image,
      entry.mode === "movie" ? "M" : "TV"
    );
''',
        '''    setEntryPoster(
      poster,
      entry,
      entry,
      entry.mode === "movie" ? "M" : "TV",
      () => card.isConnected
    );
'''
    )

    replace_regex_once(
        relative,
        r'  async function loadRelated\(entry, metadata\) \{.*?\n  \}\n\n  async function resolveEntry',
        '''  function normalizedGenreSet(entry) {
    return new Set((entry?.genres || [])
      .map(value => String(value || "").toLocaleLowerCase().trim())
      .filter(Boolean));
  }

  async function localRelated(entry, metadata) {
    if (!state.storageReady) return [];
    const sourceGenres = normalizedGenreSet(metadata);
    const sourceCategory = categoryForEntry(metadata);
    if (sourceGenres.size === 0 && sourceCategory === "Uncategorized") return [];

    const currentKey = VidCoreMetadata.entryKey(entry);
    const candidates = await VidCoreStorage.getAll(VidCoreStorage.STORES.favorites);
    const scored = [];
    for (const candidate of candidates) {
      if (candidate.key === currentKey) continue;
      const candidateGenres = normalizedGenreSet(candidate);
      let overlap = 0;
      for (const genre of sourceGenres) {
        if (candidateGenres.has(genre)) overlap += 1;
      }
      let score = overlap * 20;
      if (sourceCategory !== "Uncategorized" &&
          categoryForEntry(candidate) === sourceCategory) score += 8;
      const sourceYear = Number.parseInt(metadata?.year, 10);
      const candidateYear = Number.parseInt(candidate?.year, 10);
      if (Number.isInteger(sourceYear) && Number.isInteger(candidateYear)) {
        score += Math.max(0, 6 - Math.min(6, Math.abs(sourceYear - candidateYear)));
      }
      if (score > 0) scored.push({ candidate, score });
    }
    return scored
      .sort((left, right) => right.score - left.score)
      .slice(0, 18)
      .map(item => item.candidate);
  }

  async function loadRelated(entry, metadata) {
    state.relatedLoading = true;
    renderRelated();
    let remote = [];
    try {
      remote = await VidCoreMetadata.related(entry, metadata);
    } catch {
      remote = [];
    }
    const local = await localRelated(entry, metadata).catch(() => []);
    const seen = new Set();
    state.related = [...remote, ...local].filter(candidate => {
      try {
        const key = VidCoreMetadata.entryKey(candidate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      } catch {
        return false;
      }
    }).slice(0, 24);
    state.relatedLoading = false;

    for (const candidate of state.related) {
      state.scanner?.addResolvedImage(candidate);
    }
    renderRelated();
    renderRecommended();
  }

  async function hydrateCurrentFromLibrary(loadSuggestions = false) {
    if (!state.storageReady) return null;
    const entry = currentEntrySafe();
    const key = VidCoreMetadata.entryKey(entry);
    const saved = await VidCoreStorage.get(VidCoreStorage.STORES.favorites, key) ||
      await VidCoreStorage.get(VidCoreStorage.STORES.history, key);
    if (!saved) return null;
    state.currentMetadata = saved;
    state.currentMetadataKey = key;
    renderCurrent(entry, saved);
    if (loadSuggestions && saved.resolutionStatus === "resolved") {
      await loadRelated(entry, saved);
    }
    return saved;
  }

  async function ensureRelated() {
    if (state.relatedLoading || state.related.length) return;
    const entry = currentEntrySafe();
    const saved = await hydrateCurrentFromLibrary(false);
    if (saved?.resolutionStatus === "resolved") {
      await loadRelated(entry, saved);
      return;
    }
    await resolveEntry(entry, true);
  }

  async function resolveEntry'''
    )

    replace_once(
        relative,
        '''    if (isCurrentEntry(entry)) {
      state.currentMetadata = metadata;
      state.currentMetadataKey = key;
      renderCurrent(entry, metadata);
      state.scanner?.addResolvedImage({ ...entry, ...metadata });
      await loadRelated(entry, metadata);
    }
''',
        '''    if (isCurrentEntry(entry)) {
      const savedEntry = state.storageReady
        ? await VidCoreStorage.get(VidCoreStorage.STORES.favorites, key)
        : null;
      const displayMetadata = savedEntry
        ? {
            ...savedEntry,
            ...metadata,
            list: categoryForEntry(savedEntry),
            favorite: isFavoriteEntry(savedEntry)
          }
        : metadata;
      state.currentMetadata = displayMetadata;
      state.currentMetadataKey = key;
      renderCurrent(entry, displayMetadata);
      state.scanner?.addResolvedImage({ ...entry, ...displayMetadata });
      await loadRelated(entry, displayMetadata);
    }
'''
    )

    replace_once(
        relative,
        '''    } else if (panel === "related") {
      renderRelated();
''',
        '''    } else if (panel === "related") {
      renderRelated();
      ensureRelated().catch(error =>
        setStatus("Related lookup failed", error.message, "warn")
      );
'''
    )

    replace_regex_once(
        relative,
        r'  async function renderListControls\(\) \{.*?\n  \}\n\n  function filterLibraryEntries',
        '''  async function renderListControls() {
    if (!state.storageReady) return;

    let { lists, favorites } = await listData();
    const customCount = name =>
      favorites.filter(entry => categoryForEntry(entry) === name).length;

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

    const storedNames = lists
      .map(list => list.name)
      .filter(name => name !== "Favorites");
    const entryNames = favorites.map(categoryForEntry);
    const customNames = [...new Set([...storedNames, ...entryNames])]
      .filter(name => customCount(name) > 0 || name === state.selectedList)
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
  }

  function filterLibraryEntries'''
    )

    replace_regex_once(
        relative,
        r'  function filterLibraryEntries\(entries\) \{.*?\n  \}\n\n  async function renderLibrary',
        '''  function filterLibraryEntries(entries) {
    const search = elements.librarySearch.value
      .trim()
      .toLocaleLowerCase();

    return entries
      .filter(entry =>
        state.selectedList === "All" ||
        (state.selectedList === "Favorites"
          ? isFavoriteEntry(entry)
          : categoryForEntry(entry) === state.selectedList)
      )
      .filter(entry => {
        if (!search) return true;
        return [
          entry.title,
          entry.id,
          entry.notes,
          categoryForEntry(entry),
          ...(entry.genres || [])
        ]
          .filter(Boolean)
          .some(value =>
            String(value).toLocaleLowerCase().includes(search)
          );
      })
      .sort((left, right) =>
        String(right.updatedAt || right.createdAt || "")
          .localeCompare(
            String(left.updatedAt || left.createdAt || "")
          )
      );
  }

  async function renderLibrary'''
    )

    replace_once(
        relative,
        '      .filter(entry => entry.list === "Favorites")\n',
        '      .filter(isFavoriteEntry)\n',
    )
    replace_once(
        relative,
        '        emptyCard("Save a title to Favorites to keep it here permanently.")\n',
        '        emptyCard("Mark titles as Favorites without removing their category.")\n',
    )
    replace_once(
        relative,
        '''    if (state.related.length === 0) {
      elements.relatedCards.append(
        emptyCard("Resolve a title to load related movies or TV.")
      );
''',
        '''    if (state.related.length === 0) {
      elements.relatedCards.append(
        emptyCard(state.relatedLoading
          ? "Loading related titles…"
          : "Open Related to resolve the current title and compare it with your library.")
      );
'''
    )

    replace_regex_once(
        relative,
        r'    elements\.saveList\.value =\n      existing\?\.list \|\|\n      \(state\.activePanel === "favorites".*?\n          : "Favorites"\);',
        '''    const category = existing
      ? categoryForEntry(existing)
      : state.selectedList !== "All" && state.selectedList !== "Favorites"
        ? state.selectedList
        : "Uncategorized";
    elements.saveList.value = category;
    if (!elements.saveList.value) elements.saveList.value = "Uncategorized";
    elements.saveFavorite.checked = existing
      ? isFavoriteEntry(existing)
      : true;'''
    )

    replace_once(
        relative,
        '''        list: elements.saveList.value || "Favorites",
        notes: elements.saveNotes.value.trim(),
''',
        '''        list: elements.saveList.value || "Uncategorized",
        favorite: elements.saveFavorite.checked,
        notes: elements.saveNotes.value.trim(),
'''
    )
    replace_regex_once(
        relative,
        r'\n    const cachedImage = await requestNativeArtwork\(entry, \{.*?\n    \}\n\n    if \(elements\.saveWatched\.checked\)',
        '''
    state.localArtworkCache.clear();

    if (elements.saveWatched.checked)'''
    )
    replace_regex_once(
        relative,
        r'    const identity = mediaCacheIdentity\(entry, entry\);.*?\n    \}\n    if \(elements\.saveDialog\.open\)',
        '''    state.localArtworkCache.clear();
    if (elements.saveDialog.open)'''
    )

    replace_once(
        relative,
        '    const members = favorites.filter(entry => entry.list === name);\n',
        '    const members = favorites.filter(entry => categoryForEntry(entry) === name);\n',
    )
    replace_once(
        relative,
        '        { ...entry, list: "Favorites", updatedAt }\n',
        '        { ...entry, list: "Uncategorized", favorite: true, updatedAt }\n',
    )
    replace_once(
        relative,
        '''    return state.selectedList === "All"
      ? entries
      : entries.filter(entry => entry.list === state.selectedList);
''',
        '''    return state.selectedList === "All"
      ? entries
      : state.selectedList === "Favorites"
        ? entries.filter(isFavoriteEntry)
        : entries.filter(entry => categoryForEntry(entry) === state.selectedList);
'''
    )

    replace_once(
        relative,
        '''                list: raw.list || "Favorites",
                notes: raw.notes || "",
''',
        '''                list: raw.list && raw.list !== "Favorites"
                  ? raw.list
                  : "Uncategorized",
                favorite: Boolean(raw.favorite || raw.list === "Favorites"),
                notes: raw.notes || "",
'''
    )

    replace_once(
        relative,
        '''  async function sanitizeStoredArtwork() {
''',
        '''  async function migrateFavoriteOverlay() {
    if (!state.storageReady) return 0;
    let changed = 0;
    for (const entry of await VidCoreStorage.getAll(VidCoreStorage.STORES.favorites)) {
      const legacyFavorite = entry.list === "Favorites";
      const category = categoryForEntry(entry);
      const favorite = Boolean(entry.favorite || legacyFavorite);
      if (entry.list !== category || entry.favorite !== favorite) {
        await VidCoreStorage.put(VidCoreStorage.STORES.favorites, {
          ...entry,
          list: category,
          favorite,
          updatedAt: entry.updatedAt || new Date().toISOString()
        });
        changed += 1;
      }
    }
    return changed;
  }

  async function sanitizeStoredArtwork() {
'''
    )
    replace_once(
        relative,
        '''      const migration = await migrateLegacyData();
      const artworkCleanup = await sanitizeStoredArtwork();
''',
        '''      const migration = await migrateLegacyData();
      const favoriteOverlayMigration = await migrateFavoriteOverlay();
      const artworkCleanup = await sanitizeStoredArtwork();
'''
    )
    replace_once(
        relative,
        '''      await renderAllLibraryViews();
      await pruneNativeArtworkCache();
      const migrated = migration.favorites + migration.history;
''',
        '''      await renderAllLibraryViews();
      const restoredCurrent = await hydrateCurrentFromLibrary(false);
      if (restoredCurrent?.resolutionStatus === "resolved") {
        loadRelated(currentEntrySafe(), restoredCurrent).catch(() => {});
      }
      await pruneNativeArtworkCache();
      const migrated = migration.favorites + migration.history + favoriteOverlayMigration;
'''
    )

for relative in STORAGE_FILES:
    replace_once(
        relative,
        '''    delete expanded.provider;
    expanded.key = recordKey(expanded);
''',
        '''    delete expanded.provider;
    const legacyFavorite = expanded.list === "Favorites";
    expanded.favorite = Boolean(expanded.favorite || legacyFavorite);
    expanded.list = legacyFavorite
      ? "Uncategorized"
      : String(expanded.list || "").trim() || "Uncategorized";
    expanded.key = recordKey(expanded);
'''
    )

for relative in HTML_FILES:
    replace_once(
        relative,
        '''      <label class="check-row">
        <input id="saveWatched" type="checkbox">
        <span>Mark watched</span>
      </label>
''',
        '''      <label class="check-row">
        <input id="saveFavorite" type="checkbox" checked>
        <span>Keep in Favorites too</span>
      </label>

      <label class="check-row">
        <input id="saveWatched" type="checkbox">
        <span>Mark watched</span>
      </label>
'''
    )
    replace_once(
        relative,
        '''        Favorites, lists, notes, watched state, Continue Watching, and history use IndexedDB when available. In the native player, browser storage and cache stay in the portable data folder beside the executable. JSON export stores provider categories once, then uses compact provider indexes per title. Version 1 backups with full provider URLs remain import-compatible.
''',
        '''        Favorites are an overlay and no longer replace a title's category. Favorites, lists, notes, watched state, Continue Watching, and history use IndexedDB when available. In the native player, browser storage and cache stay in the portable data folder beside the executable. The native player creates data/artwork/category/title folders; drop several JPG, PNG, WebP, GIF, BMP, or AVIF images into a title folder and one is selected randomly for that launch. Those user-owned files are never downloaded or deleted by the player. JSON export stores provider categories once, then uses compact provider indexes per title. Version 1 backups with full provider URLs remain import-compatible.
'''
    )

for relative in METADATA_FILES:
    replace_once(
        relative,
        '      .filter(token => token.length >= 3 && !ignored.has(token));\n',
        '      .filter(token => (/^\\d+$/.test(token) || token.length >= 3) && !ignored.has(token));\n',
    )
    replace_regex_once(
        relative,
        r'  function isLikelyBadArtwork\(entry, metadata, image, sourceKind = "image"\) \{.*?\n  \}\n\n  function selectArtworkImage',
        '''  function artworkYearConflict(metadata, imageText) {
    const expected = Number.parseInt(String(metadata?.year || "").slice(0, 4), 10);
    if (!Number.isInteger(expected)) return false;
    const years = [...imageText.matchAll(/\\b(18\\d{2}|19\\d{2}|20\\d{2})\\b/g)]
      .map(match => Number.parseInt(match[1], 10));
    return years.length > 0 && !years.some(year => Math.abs(year - expected) <= 1);
  }

  function artworkTitleMatches(title, imageText) {
    const expected = meaningfulTitleTokens(title);
    const candidate = new Set(meaningfulTitleTokens(imageText));
    if (expected.length === 0) return false;
    const numeric = expected.filter(token => /^\\d+$/.test(token));
    if (numeric.some(token => !candidate.has(token))) return false;
    const overlap = expected.filter(token => candidate.has(token)).length / expected.length;
    const normalizedTitle = normalizeSearchText(title);
    if (expected.length === 1 && !imageText.includes(normalizedTitle)) return false;
    return overlap >= 0.67;
  }

  function isLikelyBadArtwork(entry, metadata, image, sourceKind = "image") {
    if (!image) return false;
    try {
      if (new URL(String(image)).protocol === "file:") return false;
    } catch {
    }

    const imageText = artworkText(image);
    if (!imageText) return true;

    if (/\\b(distribution|diagram|chart|graph|equation|histogram|map|flag|coat of arms|politics|politician|pdf|document|building|headshot|portrait|red carpet|premiere|festival|interview|award ceremony|cast photo|cast group|actor|actress|director|producer|model|football|soccer)\\b/.test(imageText)) {
      return true;
    }
    if (/\\b(title page|book cover|frontispiece|manuscript|engraving|lithograph|woodcut|facsimile|first edition|epic poem|homer|ancient greek|sheet music|soundtrack|album cover|music album|studio album|single cover|novel cover|playbill|theatre program)\\b/.test(imageText)) {
      return true;
    }
    if (artworkYearConflict(metadata, imageText)) return true;

    const title = metadata?.title || entry?.title || "";
    const identityMatches = artworkTitleMatches(title, imageText);
    if (!identityMatches) return true;

    if (/\\b(poster|key art|cover|title card|logo|movie still|film still|screenshot|screen shot|scene|promotional|publicity still)\\b/.test(imageText)) {
      return false;
    }

    return sourceKind !== "poster" && sourceKind !== "logo";
  }

  function selectArtworkImage'''
    )
    replace_regex_once(
        relative,
        r'  function isLikelyMediaArticle\(entry, metadata, page\) \{.*?\n  \}\n\n  function slugifyTitle',
        '''  function isLikelyMediaArticle(entry, metadata, page) {
    const pageTitle = page?.title || "";
    const categories = normalizeSearchText(
      (page?.categories || []).map(category => category.title || category).join(" ")
    );
    const extract = normalizeSearchText(page?.extract || "");
    const expectedTitle = metadata?.title || "";
    const normalizedPageTitle = normalizeSearchText(pageTitle);
    const normalizedExpectedTitle = normalizeSearchText(expectedTitle);
    const similarity = titleSimilarity(expectedTitle, pageTitle);
    const mediaTerms = entry.mode === "movie"
      ? /\\b(film|films|movie|cinema)\\b/
      : /\\b(television|tv series|television series|miniseries)\\b/;
    const personTerms = /\\b(living people|births|actors|actresses|film directors|television directors|models|people from|american male|american female|british male|british female)\\b/;
    const opening = extract.slice(0, 500);
    const openingMedia = entry.mode === "movie"
      ? /\\b(is|was|will be) (an? |the )?.{0,80}\\bfilm\\b/.test(opening)
      : /\\b(is|was|will be) (an? |the )?.{0,80}\\b(television|tv) (series|miniseries)\\b/.test(opening);

    if (personTerms.test(categories)) return false;
    if (!mediaTerms.test(categories) && !openingMedia) return false;

    const expectedYear = String(metadata?.year || "").slice(0, 4);
    const candidateYears = [...`${normalizedPageTitle} ${categories} ${extract}`.matchAll(/\\b(19\\d{2}|20\\d{2})\\b/g)]
      .map(match => match[1]);
    if (expectedYear && candidateYears.length && !candidateYears.includes(expectedYear)) return false;
    if (meaningfulTitleTokens(expectedTitle).length <= 1 &&
        normalizedPageTitle !== normalizedExpectedTitle &&
        !(expectedYear && normalizedPageTitle.includes(`${normalizedExpectedTitle} ${expectedYear}`))) {
      return false;
    }
    return similarity >= 0.67 || normalizedPageTitle === normalizedExpectedTitle;
  }

  function slugifyTitle'''
    )
    replace_once(
        relative,
        '''    if (year && combined.includes(year)) score += 22;
    if (imdb && combined.includes(imdb)) score += 80;
''',
        '''    const candidateYears = [...combined.matchAll(/\\b(19\\d{2}|20\\d{2})\\b/g)]
      .map(match => match[1]);
    if (year && combined.includes(year)) score += 30;
    else if (year && candidateYears.length) score -= 120;
    if (meaningfulTitleTokens(metadata?.title).length <= 1 &&
        title !== expectedTitle &&
        !(year && title.includes(`${expectedTitle} ${year}`))) score -= 90;
    if (imdb && combined.includes(imdb)) score += 80;
'''
    )
    replace_regex_once(
        relative,
        r'  function relatedQuery\(entry, metadata\) \{.*?\n  \}\n\n  async function related',
        '''  function relatedQuery(entry, metadata) {
    const genreUris = (metadata.genreUris || [])
      .filter(value => /^https?:\\/\\/www\\.wikidata\\.org\\/entity\\/Q\\d+$/i.test(value))
      .slice(0, 4);
    const genreLabels = (metadata.genres || [])
      .map(value => String(value || "").toLocaleLowerCase().trim())
      .filter(Boolean)
      .slice(0, 4);

    if (genreUris.length === 0 && genreLabels.length === 0) return "";

    const identifier = entry.mode === "movie" ? "movieTmdb" : "tvTmdb";
    const property = entry.mode === "movie" ? "P4947" : "P4983";
    const genreClause = genreUris.length
      ? `VALUES ?genre { ${genreUris.map(value => `<${value}>`).join(" ")} }`
      : `?genre rdfs:label ?genreLabel.
         FILTER(LANG(?genreLabel) = "en")
         FILTER(LCASE(STR(?genreLabel)) IN (${genreLabels.map(sparqlLiteral).join(", ")}))`;
    const exclusion = /^https?:\\/\\/www\\.wikidata\\.org\\/entity\\/Q\\d+$/i.test(
      metadata.wikidata || ""
    )
      ? `FILTER(?item != <${metadata.wikidata}>)`
      : "";

    return `SELECT DISTINCT ?item ?itemLabel ?itemDescription ?date ?poster ?logo ?image
             ?imdb ?${identifier} ?article WHERE {
      ${genreClause}
      ?item wdt:P136 ?genre;
            wdt:${property} ?${identifier}.
      ${exclusion}
      OPTIONAL { ?item wdt:P577 ?date. }
      OPTIONAL { ?item wdt:P3383 ?poster. }
      OPTIONAL { ?item wdt:P154 ?logo. }
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P345 ?imdb. }
      OPTIONAL {
        ?article schema:about ?item;
                 schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "en".
      }
    }
    ORDER BY DESC(?date)
    LIMIT 48`;
  }

  async function related'''
    )
    replace_once(
        relative,
        '''        }, [
          { kind: "image", value: bindingValue(binding, "image") }
        ]),
''',
        '''        }, [
          { kind: "poster", value: bindingValue(binding, "poster") },
          { kind: "logo", value: bindingValue(binding, "logo") },
          { kind: "image", value: bindingValue(binding, "image") }
        ]),
'''
    )
    replace_once(
        relative,
        '    related,\n    imdbUrl,\n',
        '    related,\n    relatedQuery,\n    imdbUrl,\n',
    )

replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''#include <filesystem>
#include <functional>
#include <string>
''',
    '''#include <filesystem>
#include <fstream>
#include <functional>
#include <random>
#include <string>
'''
)
replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''#include <utility>
#include <windows.h>
#include <objbase.h>
#include <shellapi.h>
''',
    '''#include <utility>
#include <vector>
#include <windows.h>
#include <objbase.h>
#include <shellapi.h>
#include <shlwapi.h>
'''
)
replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''    void handle_message(const std::wstring& message) {
''',
    '''    [[nodiscard]] static std::vector<std::wstring> split_fields(
        const std::wstring& value
    ) {
        std::vector<std::wstring> fields;
        std::size_t begin = 0;
        while (begin <= value.size()) {
            const auto end = value.find(L'|', begin);
            fields.push_back(value.substr(
                begin,
                end == std::wstring::npos ? std::wstring::npos : end - begin
            ));
            if (end == std::wstring::npos) break;
            begin = end + 1;
        }
        return fields;
    }

    [[nodiscard]] static std::wstring decode_component(std::wstring value) {
        std::vector<wchar_t> buffer(value.size() + 1, L'\\0');
        auto length = static_cast<DWORD>(buffer.size());
        if (SUCCEEDED(UrlUnescapeW(
            value.data(),
            buffer.data(),
            &length,
            URL_UNESCAPE_AS_UTF8
        ))) {
            return std::wstring{buffer.data(), length};
        }
        return value;
    }

    [[nodiscard]] static std::wstring safe_path_component(
        std::wstring value,
        std::wstring_view fallback
    ) {
        value = uri::trim(std::move(value));
        std::wstring safe;
        safe.reserve(value.size());
        constexpr std::wstring_view invalid = L"<>:\\"/\\\\|?*";
        for (const auto character : value) {
            if (character < 32 || invalid.find(character) != std::wstring_view::npos) {
                safe.push_back(L'-');
            } else {
                safe.push_back(character);
            }
        }
        safe = uri::trim(std::move(safe));
        while (!safe.empty() && (safe.back() == L'.' || safe.back() == L' ')) {
            safe.pop_back();
        }
        if (safe.empty()) safe = fallback;
        if (safe.size() > 96) safe.resize(96);
        return safe;
    }

    [[nodiscard]] static bool supported_artwork(
        const std::filesystem::path& path
    ) {
        const auto extension = uri::lowercase(path.extension().wstring());
        return extension == L".jpg" || extension == L".jpeg" ||
            extension == L".png" || extension == L".webp" ||
            extension == L".gif" || extension == L".bmp" ||
            extension == L".avif";
    }

    [[nodiscard]] std::filesystem::path artwork_root() const {
        return blocklist_.directory() / L"artwork";
    }

    void ensure_artwork_readme() const {
        std::error_code error;
        const auto root = artwork_root();
        std::filesystem::create_directories(root, error);
        const auto readme = root / L"README.txt";
        if (std::filesystem::exists(readme, error)) return;
        std::wofstream output{readme};
        output << L"Drop your own JPG, JPEG, PNG, WebP, GIF, BMP, or AVIF files into the generated category/title folders.\\n"
               << L"The player chooses one image per title at random each launch.\\n"
               << L"These files are user-owned and are never downloaded, changed, or deleted by the player.\\n";
    }

    void collect_artwork(
        const std::filesystem::path& directory,
        std::vector<std::filesystem::path>& images
    ) const {
        std::error_code error;
        if (!std::filesystem::exists(directory, error)) return;
        for (const auto& candidate : std::filesystem::directory_iterator(directory, error)) {
            if (error) break;
            if (candidate.is_regular_file(error) && supported_artwork(candidate.path())) {
                images.push_back(candidate.path());
            }
            error.clear();
        }
    }

    void resolve_local_artwork(const std::wstring& payload) {
        const auto fields = split_fields(payload);
        if (fields.size() < 5 || fields[0].empty()) return;

        ensure_artwork_readme();
        const auto request_id = fields[0];
        const auto category = safe_path_component(
            decode_component(fields[1]),
            L"Uncategorized"
        );
        const auto identity = safe_path_component(
            decode_component(fields[2]),
            L"unknown"
        );
        const auto title = safe_path_component(
            decode_component(fields[3]),
            identity
        );
        const bool favorite = fields[4] == L"1";
        const auto item = safe_path_component(
            title + L" [" + identity + L"]",
            identity
        );

        std::error_code error;
        const auto primary = artwork_root() / category / item;
        std::filesystem::create_directories(primary, error);
        std::vector<std::filesystem::path> directories{primary};
        if (favorite && category != L"Favorites") {
            const auto favorites = artwork_root() / L"Favorites" / item;
            error.clear();
            std::filesystem::create_directories(favorites, error);
            directories.push_back(favorites);
        }

        std::vector<std::filesystem::path> images;
        for (const auto& directory : directories) collect_artwork(directory, images);

        std::wstring event{L"image-resolved|"};
        event.append(request_id);
        event.push_back(L'|');
        if (!images.empty()) {
            std::uniform_int_distribution<std::size_t> distribution{0, images.size() - 1};
            event.append(uri::file_url(images[distribution(artwork_random_)]));
        }
        post_event(event);
    }

    void handle_message(const std::wstring& message) {
'''
)
replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''        if (command == L"ready") {
            post_event(L"zoom|1.00");
''',
    '''        if (command == L"ready") {
            ensure_artwork_readme();
            post_event(L"zoom|1.00");
'''
)
replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''        if (command == L"open-data-folder") {
            ShellExecuteW(
''',
    '''        if (command == L"local-artwork") {
            resolve_local_artwork(payload);
            return;
        }

        if (command == L"open-data-folder") {
            ensure_artwork_readme();
            ShellExecuteW(
'''
)
replace_once(
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    '''    bool shell_loaded_{false};
''',
    '''    std::mt19937_64 artwork_random_{std::random_device{}()};
    bool shell_loaded_{false};
'''
)

replace_once(
    "VidCoreNativePlayer/CMakeLists.txt",
    "VERSION 0.2.13",
    "VERSION 0.2.14",
)
(ROOT / "VERSION").write_text("0.2.14\n", encoding="utf-8")

replace_once(
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    '  "deleteListButton"\n',
    '  "deleteListButton",\n  "saveFavorite"\n',
)
replace_once(
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    'assert.match(app, /const names = \\["All", "Favorites", \\.\\.\\.customNames\\]/);\n',
    'assert.match(app, /const names = \\["All", "Favorites", \\.\\.\\.customNames\\]/);\nassert.match(app, /function isFavoriteEntry/);\nassert.match(app, /local-artwork/);\nassert.match(app, /ensureRelated/);\n',
)
replace_once(
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    'assert.match(app, /list: "Favorites"/);\n',
    'assert.match(app, /favorite: elements\\.saveFavorite\\.checked/);\nassert.match(app, /list: "Uncategorized"/);\n',
)
replace_once(
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    'assert.match(webview, /executable_directory/);\n',
    'assert.match(webview, /executable_directory/);\nassert.match(webview, /local-artwork/);\nassert.match(webview, /artwork_root/);\nassert.match(webview, /README\\.txt/);\n',
)

logic_path = "VidCoreNativePlayer/tests/logic.test.mjs"
logic_text = read(logic_path)
logic_insert = '''
assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "Nobody 2" },
    { title: "Nobody 2", year: "2025" },
    "https://commons.wikimedia.org/Nobodys-Children-1920-film-poster.jpg",
    "poster"
  ),
  true
);
assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "The Odyssey" },
    { title: "The Odyssey", year: "2026" },
    "https://commons.wikimedia.org/Homer-The-Odyssey-title-page.jpg"
  ),
  true
);
assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "In the Grey" },
    { title: "In the Grey", year: "2026" },
    "https://commons.wikimedia.org/Indigo-Grey-The-Past-Sage-soundtrack-cover.jpg",
    "poster"
  ),
  true
);
assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "Nobody 2" },
    { title: "Nobody 2", year: "2025" },
    "https://commons.wikimedia.org/Nobody-2-2025-film-poster.jpg",
    "poster"
  ),
  false
);
assert.match(
  metadata.relatedQuery(
    { mode: "movie", id: "1" },
    { genres: ["action film"], genreUris: [] }
  ),
  /genreLabel/
);
'''
if logic_insert.strip() not in logic_text:
    logic_text += logic_insert
write(logic_path, logic_text)

replace_once(
    "VidCoreNativePlayer/tests/storage-format.test.mjs",
    '''  title: "Date Movie",
  list: "Favorites"
});
''',
    '''  title: "Date Movie",
  list: "Comedy",
  favorite: true
});
'''
)
replace_once(
    "VidCoreNativePlayer/tests/storage-format.test.mjs",
    '''assert.equal(imported[0].baseUrl, "https://vidup.to");
''',
    '''assert.equal(imported[0].baseUrl, "https://vidup.to");
assert.equal(imported[0].favorite, true);
assert.equal(imported[0].list, "Uncategorized");
'''
)
replace_once(
    "VidCoreNativePlayer/tests/storage-format.test.mjs",
    '''assert.equal(imported[0].baseUrl, "https://ythd.org/embed");
''',
    '''assert.equal(imported[0].baseUrl, "https://ythd.org/embed");
assert.equal(imported[0].favorite, true);
assert.equal(imported[0].list, "Comedy");
'''
)

readme = read("VidCoreNativePlayer/README.md")
readme += '''

## v0.2.14 local artwork, category, and resolver corrections

- The native package includes `data/artwork/README.txt`.
- Launching the native player creates `data/artwork/<category>/<title [identity]>/` folders for saved titles. Favorite titles also receive a Favorites overlay folder without leaving their normal category.
- Drop several JPG, JPEG, PNG, WebP, GIF, BMP, or AVIF files into either generated title folder. One image is chosen randomly per title for the current launch and remains stable for that session.
- User artwork is never downloaded, modified, pruned, or deleted by the player.
- Favorites is now a boolean overlay instead of an exclusive category. Legacy Favorites-only entries migrate to `Uncategorized` while remaining favorited.
- Related automatically hydrates the current saved title, retries public genre matching using labels when Wikidata genre URIs are absent, and falls back to genre/category matches from the local library.
- Artwork validation now preserves sequel numbers, rejects conflicting years, and blocks book/title-page, ancient-text, soundtrack, album, and unrelated historical-poster matches such as the reported Odyssey, Nobody 2, and In the Grey failures.
'''
write("VidCoreNativePlayer/README.md", readme)

agents = read("AGENTS.md")
agents = agents.replace(
    "- Favorites is permanent.\n- Deleting a custom list moves its titles to Favorites.\n",
    "- Favorites is permanent and acts as an overlay; favoriting a title never removes its normal category.\n- Deleting a custom list moves its titles to `Uncategorized` and preserves them in Favorites.\n",
)
agents = agents.replace(
    "The safe native baseline uses WebView2 normally and stores its profile, HTTP cache, IndexedDB, localStorage, settings, and popup history under `data/` beside the executable.\n",
    "The safe native baseline uses WebView2 normally and stores its profile, HTTP cache, IndexedDB, localStorage, settings, and popup history under `data/` beside the executable. User-supplied artwork under `data/artwork/` may be enumerated and displayed locally, but it must never be downloaded, rewritten, pruned, or deleted by the application.\n",
)
write("AGENTS.md", agents)

mission = read("missioncache.md")
completed_anchor = "- [x] Restore the normal `VERSION`-only release workflow after publication while retaining the 114-entry release notes and corrected asset policy.\n"
completed_add = completed_anchor + """- [x] Reproduce the reported artwork mismatch classes from the supplied screenshots: classical-book/title-page art for The Odyssey, an unrelated historical Nobody poster for Nobody 2, and soundtrack art for In the Grey.
- [x] Add local user-owned artwork folders under `data/artwork/<category>/<title [identity]>/` with one random image selected per title per launch and no application-managed download or deletion behavior.
- [x] Convert Favorites into a non-exclusive overlay so titles remain in their normal categories, with legacy Favorites-only records migrated to Uncategorized.
- [x] Repair Related with automatic current-title hydration, public genre-label fallback, and local-library genre/category fallback.
- [x] Tighten artwork acceptance around sequel numbers, conflicting years, article media type, book/title-page imagery, historical source material, soundtrack/album art, and unrelated posters.
"""
if completed_anchor not in mission:
    raise RuntimeError("Mission cache completion anchor not found.")
mission = mission.replace(completed_anchor, completed_add, 1)
open_anchor = "## Open / provider-limited\n\n"
mission = mission.replace(
    open_anchor,
    open_anchor + "- [ ] Publish v0.2.14 with local artwork folders, Favorites overlay semantics, Related repair, and stricter artwork identity validation.\n- [ ] Verify the downloadable v0.2.14 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.\n",
    1,
)
mission = mission.replace(
    "- [ ] Verify the downloadable v0.2.13 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.\n",
    "- [x] Supersede the unverified v0.2.13 Windows artifact with v0.2.14 before local endpoint verification.\n",
)
write("missioncache.md", mission)

native_app = read("VidCoreNativePlayer/assets/app.js")
web_app = read("VidCoreWebPlayer/app.js")
if native_app != web_app:
    raise RuntimeError("Native and Web app.js diverged.")
if read("VidCoreNativePlayer/assets/metadata.js") != read("VidCoreWebPlayer/metadata.js"):
    raise RuntimeError("Native and Web metadata.js diverged.")
if read("VidCoreNativePlayer/assets/storage.js") != read("VidCoreWebPlayer/storage.js"):
    raise RuntimeError("Native and Web storage.js diverged.")
if read("VidCoreNativePlayer/assets/index.html") != read("VidCoreWebPlayer/index.html"):
    raise RuntimeError("Native and Web index.html diverged.")
