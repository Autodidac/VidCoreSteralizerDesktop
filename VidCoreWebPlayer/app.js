"use strict";

(() => {
  const SETTINGS_PREFIX = "vidcoreNative.settings.";
  const RESERVED_LISTS = new Set([
    "all",
    "favorites",
    "continue",
    "recommended",
    "related",
    "blocked"
  ]);

  const $ = selector => document.querySelector(selector);
  const elements = {
    baseUrl: $("#baseUrl"),
    mode: $("#mode"),
    mediaId: $("#mediaId"),
    season: $("#season"),
    episode: $("#episode"),
    seasonField: $("#seasonField"),
    episodeField: $("#episodeField"),
    previousButton: $("#previousButton"),
    playButton: $("#playButton"),
    nextButton: $("#nextButton"),
    randomMode: $("#randomMode"),
    randomButton: $("#randomButton"),
    resolveButton: $("#resolveButton"),
    favoriteButton: $("#favoriteButton"),
    currentPoster: $("#currentPoster"),
    currentType: $("#currentType"),
    currentTitle: $("#currentTitle"),
    currentMeta: $("#currentMeta"),
    currentDescription: $("#currentDescription"),
    currentGenres: $("#currentGenres"),
    imdbButton: $("#imdbButton"),
    tmdbButton: $("#tmdbButton"),
    wikipediaButton: $("#wikipediaButton"),
    fastflixButton: $("#fastflixButton"),
    seeflixButton: $("#seeflixButton"),
    movies123Button: $("#movies123Button"),
    playerShell: $("#playerShell"),
    player: $("#player"),
    emptyPlayer: $("#emptyPlayer"),
    stopButton: $("#stopButton"),
    copyUrlButton: $("#copyUrlButton"),
    muteButton: $("#muteButton"),
    theaterModeButton: $("#theaterModeButton"),
    fullscreenButton: $("#fullscreenButton"),
    devtoolsButton: $("#devtoolsButton"),
    zoomOutButton: $("#zoomOutButton"),
    zoomInButton: $("#zoomInButton"),
    zoomSlider: $("#zoomSlider"),
    zoomOutput: $("#zoomOutput"),
    statusPanel: $("#statusPanel"),
    statusTitle: $("#statusTitle"),
    statusText: $("#statusText"),
    reloadShellButton: $("#reloadShellButton"),
    dataFolderButton: $("#dataFolderButton"),
    shieldHelpButton: $("#shieldHelpButton"),
    storageInfoButton: $("#storageInfoButton"),
    tabs: [...document.querySelectorAll(".tab")],
    libraryPanel: $("#libraryPanel"),
    favoritesPanel: $("#favoritesPanel"),
    continuePanel: $("#continuePanel"),
    recommendedPanel: $("#recommendedPanel"),
    relatedPanel: $("#relatedPanel"),
    blockedPanel: $("#blockedPanel"),
    librarySearch: $("#librarySearch"),
    newListName: $("#newListName"),
    addListButton: $("#addListButton"),
    resolveListButton: $("#resolveListButton"),
    markListWatchedButton: $("#markListWatchedButton"),
    listChips: $("#listChips"),
    libraryCards: $("#libraryCards"),
    favoritesCards: $("#favoritesCards"),
    continueCards: $("#continueCards"),
    recommendedCards: $("#recommendedCards"),
    relatedCards: $("#relatedCards"),
    blockedCards: $("#blockedCards"),
    clearBlockedButton: $("#clearBlockedButton"),
    exportButton: $("#exportButton"),
    importButton: $("#importButton"),
    importFile: $("#importFile"),
    storageMode: $("#storageMode"),
    saveDialog: $("#saveDialog"),
    saveForm: $("#saveForm"),
    saveDialogTitle: $("#saveDialogTitle"),
    saveList: $("#saveList"),
    saveNotes: $("#saveNotes"),
    saveWatched: $("#saveWatched"),
    cancelSaveButton: $("#cancelSaveButton"),
    deleteDialogButton: $("#deleteDialogButton"),
    storageDialog: $("#storageDialog"),
    closeStorageDialogButton: $("#closeStorageDialogButton"),
    shieldDialog: $("#shieldDialog"),
    closeShieldDialogButton: $("#closeShieldDialogButton"),
  };

  const state = {
    storageReady: false,
    selectedList: "All",
    currentMetadata: null,
    currentMetadataKey: "",
    related: [],
    activePanel: "library",
    blocked: [],
    muted: false,
    theater: false,
    editingKey: "",
    dialogEntry: null,
    scanner: null,
    artworkSequence: 0,
    artworkRequests: new Map()
  };

  function postHost(message) {
    globalThis.chrome?.webview?.postMessage(String(message));
  }



  function mediaCacheIdentity(entry, metadata = entry) {
    const mode = entry?.mode === "tv" ? "tv" : "movie";
    const imdb = String(metadata?.imdb || (/^tt\d+$/i.test(entry?.id || "") ? entry.id : "")).toLowerCase();
    if (imdb) return `${mode}:imdb:${imdb}`;
    const tmdb = String(metadata?.tmdb || (/^\d+$/.test(entry?.id || "") ? entry.id : ""));
    if (tmdb) return `${mode}:tmdb:${tmdb}`;
    return `${mode}:id:${String(entry?.id || "unknown").toLowerCase()}`;
  }

  function requestNativeArtwork(entry, metadata = entry) {
    if (!globalThis.chrome?.webview) {
      return Promise.resolve("");
    }

    const requestId = String(++state.artworkSequence);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        state.artworkRequests.delete(requestId);
        resolve("");
      }, 18000);
      state.artworkRequests.set(requestId, { resolve, timer });
      postHost([
        "resolve-image",
        requestId,
        entry.mode === "tv" ? "tv" : "movie",
        entry.id || "",
        metadata?.imdb || "",
        metadata?.tmdb || ""
      ].join("|"));
    });
  }

  async function preferOfficialArtwork(entry, metadata) {
    try {
      const image = await requestNativeArtwork(entry, metadata);
      return image
        ? {
            ...metadata,
            image,
            artworkSource: "IMDb/TMDB local cache"
          }
        : metadata;
    } catch {
      return metadata;
    }
  }

  async function pruneNativeArtworkCache() {
    if (!state.storageReady || !globalThis.chrome?.webview) return;
    const favorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    const identities = [...new Set(
      favorites.map(entry => mediaCacheIdentity(entry, entry))
    )];
    postHost(`prune-image-cache|${identities.join(",")}`);
  }

  function setStatus(title, text, type = "") {
    elements.statusTitle.textContent = title;
    elements.statusText.textContent = text;
    elements.statusPanel.dataset.type = type;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  }

  function currentEntry() {
    return VidCoreMetadata.normalizeEntry({
      baseUrl: elements.baseUrl.value,
      mode: elements.mode.value,
      id: elements.mediaId.value,
      season: elements.season.value,
      episode: elements.episode.value
    });
  }

  function currentEntrySafe() {
    try {
      return currentEntry();
    } catch {
      return {
        baseUrl: elements.baseUrl.value.trim() || "https://vidcore.net",
        mode: elements.mode.value === "tv" ? "tv" : "movie",
        id: elements.mediaId.value.trim() || "1",
        season: Math.max(0, Number.parseInt(elements.season.value, 10) || 1),
        episode: Math.max(1, Number.parseInt(elements.episode.value, 10) || 1)
      };
    }
  }

  function isCurrentEntry(entry) {
    try {
      return VidCoreMetadata.entryKey(currentEntry()) ===
        VidCoreMetadata.entryKey(entry);
    } catch {
      return false;
    }
  }

  function applyEntry(entry) {
    elements.baseUrl.value = entry.baseUrl || "https://vidcore.net";
    elements.mode.value = entry.mode === "tv" ? "tv" : "movie";
    elements.mediaId.value = entry.id || "1";
    elements.season.value = entry.season ?? 1;
    elements.episode.value = entry.episode ?? 1;
    syncModeFields();
    resetCurrentMetadataIfChanged();
  }

  function saveSettings(entry) {
    localStorage.setItem(
      `${SETTINGS_PREFIX}baseUrl`,
      entry.baseUrl
    );
    localStorage.setItem(
      `${SETTINGS_PREFIX}mode`,
      entry.mode
    );
    localStorage.setItem(
      `${SETTINGS_PREFIX}mediaId`,
      entry.id
    );
    localStorage.setItem(
      `${SETTINGS_PREFIX}season`,
      String(entry.season ?? 1)
    );
    localStorage.setItem(
      `${SETTINGS_PREFIX}episode`,
      String(entry.episode ?? 1)
    );
    localStorage.setItem(
      `${SETTINGS_PREFIX}randomMode`,
      elements.randomMode.value || "database"
    );
  }

  function restoreSettings() {
    elements.baseUrl.value =
      localStorage.getItem(`${SETTINGS_PREFIX}baseUrl`) ||
      "https://vidcore.net";
    elements.mode.value =
      localStorage.getItem(`${SETTINGS_PREFIX}mode`) ||
      "movie";
    elements.mediaId.value =
      localStorage.getItem(`${SETTINGS_PREFIX}mediaId`) ||
      "1";
    elements.season.value =
      localStorage.getItem(`${SETTINGS_PREFIX}season`) ||
      "1";
    elements.episode.value =
      localStorage.getItem(`${SETTINGS_PREFIX}episode`) ||
      "1";
    elements.randomMode.value =
      localStorage.getItem(`${SETTINGS_PREFIX}randomMode`) ||
      "database";
    syncModeFields();
  }

  function syncModeFields() {
    const television = elements.mode.value === "tv";
    elements.seasonField.classList.toggle("hidden", !television);
    elements.episodeField.classList.toggle("hidden", !television);
  }

  function emptyMetadata(entry) {
    return {
      title: VidCoreMetadata.fallbackTitle(entry),
      description:
        "Play directly, resolve metadata, or scan to a verified public identifier.",
      year: "",
      image: "",
      imdb: /^tt\d+$/i.test(entry.id) ? entry.id : "",
      tmdb: /^\d+$/.test(entry.id) ? entry.id : "",
      genres: [],
      resolutionStatus: "unresolved"
    };
  }

  function resetCurrentMetadataIfChanged() {
    const entry = currentEntrySafe();
    const key = VidCoreMetadata.entryKey(entry);

    if (state.currentMetadataKey !== key) {
      state.currentMetadata = null;
      state.currentMetadataKey = "";
      state.related = [];
      renderCurrent(entry, emptyMetadata(entry));
      renderRelated();
    }
  }

  function setPoster(container, image, fallback = "?") {
    container.replaceChildren();

    if (!image) {
      container.classList.add("fallback");
      container.textContent = fallback;
      return;
    }

    container.classList.remove("fallback");
    const poster = document.createElement("img");
    poster.alt = "";
    poster.loading = "lazy";
    poster.src = image;
    poster.addEventListener("error", () => {
      container.classList.add("fallback");
      container.replaceChildren();
      container.textContent = fallback;
    });
    container.append(poster);
  }

  function renderCurrent(entry, metadata) {
    elements.currentType.textContent = entry.mode === "movie"
      ? "Movie"
      : `TV · Season ${entry.season} · Episode ${entry.episode}`;
    elements.currentTitle.textContent =
      metadata.title || VidCoreMetadata.fallbackTitle(entry);
    elements.currentDescription.textContent =
      metadata.description ||
      "No description is available for this identifier.";

    setPoster(
      elements.currentPoster,
      VidCoreMetadata.isLikelyBadArtwork(entry, metadata, metadata.image)
        ? ""
        : metadata.image,
      entry.mode === "movie" ? "M" : "TV"
    );

    elements.currentMeta.replaceChildren();
    const metadataValues = [
      metadata.year,
      metadata.resolutionStatus === "resolved" ? "Resolved" : "Unresolved",
      metadata.imdb ? `IMDb ${metadata.imdb}` : "",
      metadata.tmdb ? `TMDB ${metadata.tmdb}` : ""
    ].filter(Boolean);

    for (const value of metadataValues) {
      const chip = document.createElement("span");
      chip.textContent = value;
      elements.currentMeta.append(chip);
    }

    elements.currentGenres.replaceChildren();
    for (const genre of metadata.genres || []) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = genre;
      elements.currentGenres.append(tag);
    }

    const imdbUrl = VidCoreMetadata.imdbUrl(metadata);
    const tmdbUrl = VidCoreMetadata.tmdbUrl(entry, metadata);
    const wikipediaUrl = metadata.wikipedia || metadata.article || "";

    elements.imdbButton.classList.toggle("hidden", !imdbUrl);
    elements.tmdbButton.classList.toggle("hidden", !tmdbUrl);
    elements.wikipediaButton.classList.toggle("hidden", !wikipediaUrl);

    elements.imdbButton.dataset.url = imdbUrl;
    elements.tmdbButton.dataset.url = tmdbUrl;
    elements.wikipediaButton.dataset.url = wikipediaUrl;

    const catalogUrls = VidCoreMetadata.externalCatalogUrls(entry, metadata);
    for (const [button, url] of [
      [elements.fastflixButton, catalogUrls.fastflix],
      [elements.seeflixButton, catalogUrls.seeflix],
      [elements.movies123Button, catalogUrls.movies123]
    ]) {
      button.classList.toggle("hidden", !url);
      button.dataset.url = url;
    }
  }

  async function persistMetadata(entry, metadata) {
    if (!state.storageReady) return;

    const key = VidCoreMetadata.entryKey(entry);
    const [favorite, history] = await Promise.all([
      VidCoreStorage.get(VidCoreStorage.STORES.favorites, key),
      VidCoreStorage.get(VidCoreStorage.STORES.history, key)
    ]);

    if (favorite) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.favorites,
        {
          ...favorite,
          ...metadata,
          updatedAt: new Date().toISOString()
        }
      );
    }

    if (history) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.history,
        {
          ...history,
          ...metadata
        }
      );
    }
  }

  async function loadRelated(entry, metadata) {
    try {
      state.related = await VidCoreMetadata.related(entry, metadata);
      for (const candidate of state.related) {
        state.scanner?.addResolvedImage(candidate);
      }
    } catch {
      state.related = [];
    }

    renderRelated();
    renderRecommended();
  }

  async function resolveEntry(entry, quiet = false) {
    const key = VidCoreMetadata.entryKey(entry);

    if (!quiet) {
      setStatus(
        "Resolving metadata",
        `Checking public metadata for ${VidCoreMetadata.fallbackTitle(entry)}…`
      );
    }

    let metadata = await VidCoreMetadata.resolve(entry);
    metadata = await preferOfficialArtwork(entry, metadata);

    if (isCurrentEntry(entry)) {
      state.currentMetadata = metadata;
      state.currentMetadataKey = key;
      renderCurrent(entry, metadata);
      state.scanner?.addResolvedImage({ ...entry, ...metadata });
      await loadRelated(entry, metadata);
    }

    await persistMetadata(entry, metadata);

    if (!quiet) {
      if (metadata.resolutionStatus === "resolved") {
        setStatus(
          "Metadata resolved",
          metadata.title,
          "ok"
        );
      } else {
        setStatus(
          "No public match",
          `No Wikidata entry was found for ${entry.id}.`,
          "warn"
        );
      }
    }

    return metadata;
  }

  async function resolveCurrent(quiet = false) {
    try {
      const entry = currentEntry();
      return await resolveEntry(entry, quiet);
    } catch (error) {
      if (!quiet) {
        setStatus("Metadata resolution failed", error.message, "error");
      }
      throw error;
    }
  }

  async function updateHistory(entry, metadata = null) {
    if (!state.storageReady) return;

    const key = VidCoreMetadata.entryKey(entry);
    const existing = await VidCoreStorage.get(
      VidCoreStorage.STORES.history,
      key
    );

    await VidCoreStorage.put(
      VidCoreStorage.STORES.history,
      {
        ...existing,
        ...entry,
        ...(metadata || {}),
        key,
        title:
          metadata?.title ||
          existing?.title ||
          VidCoreMetadata.fallbackTitle(entry),
        lastPlayedAt: new Date().toISOString(),
        completed: false
      }
    );

    await renderContinueWatching();
  }

  async function play(entry = null, prefetchedMetadata = null) {
    try {
      const target = VidCoreMetadata.normalizeEntry(entry || currentEntry());
      applyEntry(target);
      saveSettings(target);

      const url = VidCoreMetadata.buildPlayerUrl(target, true);
      elements.player.src = url;
      elements.emptyPlayer.classList.add("hidden");

      if (prefetchedMetadata) {
        state.currentMetadata = prefetchedMetadata;
        state.currentMetadataKey = VidCoreMetadata.entryKey(target);
        renderCurrent(target, prefetchedMetadata);
        state.scanner?.addResolvedImage({
          ...target,
          ...prefetchedMetadata
        });
        await loadRelated(target, prefetchedMetadata);
      } else {
        resetCurrentMetadataIfChanged();
      }

      await updateHistory(
        target,
        prefetchedMetadata || state.currentMetadata
      );

      setStatus("Stream loaded", url, "ok");

      if (!prefetchedMetadata) {
        resolveEntry(target, true).catch(() => {});
      }
    } catch (error) {
      setStatus("Cannot play", error.message, "error");
    }
  }

  function stopPlayer() {
    elements.player.src = "about:blank";
    elements.emptyPlayer.classList.remove("hidden");
    setStatus("Player stopped", "The provider frame was unloaded.");
  }

  async function copyPlayerUrl() {
    try {
      const url = VidCoreMetadata.buildPlayerUrl(currentEntry(), true);
      await navigator.clipboard.writeText(url);
      setStatus("URL copied", url, "ok");
    } catch (error) {
      setStatus("Copy failed", error.message, "error");
    }
  }

  function openExternal(url) {
    if (!url) return;
    postHost(`open-external|${url}`);
  }

  function showPanel(panel) {
    state.activePanel = panel;

    for (const tab of elements.tabs) {
      tab.classList.toggle(
        "active",
        tab.dataset.panel === panel
      );
    }

    const panels = {
      library: elements.libraryPanel,
      favorites: elements.favoritesPanel,
      continue: elements.continuePanel,
      recommended: elements.recommendedPanel,
      related: elements.relatedPanel,
      blocked: elements.blockedPanel
    };

    for (const [name, element] of Object.entries(panels)) {
      element.classList.toggle("hidden", name !== panel);
    }

    if (panel === "favorites") {
      renderFavorites();
    } else if (panel === "recommended") {
      renderRecommended();
    } else if (panel === "related") {
      renderRelated();
    } else if (panel === "continue") {
      renderContinueWatching();
    } else if (panel === "blocked") {
      renderBlocked();
    }
  }

  function createButton(label, action, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${className}`.trim();
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function createMediaCard(
    entry,
    options = {}
  ) {
    const card = document.createElement("article");
    card.className = "media-card";

    const poster = document.createElement("div");
    poster.className = "card-poster";
    setPoster(
      poster,
      VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)
        ? ""
        : entry.image,
      entry.mode === "movie" ? "M" : "TV"
    );

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent =
      entry.title || VidCoreMetadata.fallbackTitle(entry);
    title.title = title.textContent;

    const metadata = document.createElement("div");
    metadata.className = "card-meta";

    const values = [
      entry.mode === "movie"
        ? "Movie"
        : `TV · S${entry.season || 1} E${entry.episode || 1}`,
      entry.year,
      entry.list,
      entry.watched || entry.completed ? "Watched" : "",
      options.source || ""
    ].filter(Boolean);

    for (const value of values) {
      const span = document.createElement("span");
      span.textContent = value;
      metadata.append(span);
    }

    body.append(title, metadata);

    if (entry.notes) {
      const notes = document.createElement("p");
      notes.className = "card-notes";
      notes.textContent = entry.notes;
      body.append(notes);
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      createButton(
        "Play",
        () => play(entry, entry.resolutionStatus === "resolved" ? entry : null),
        "primary"
      )
    );

    if (options.links) {
      const imdbUrl = VidCoreMetadata.imdbUrl(entry);
      const tmdbUrl = VidCoreMetadata.tmdbUrl(entry, entry);

      if (imdbUrl) {
        actions.append(
          createButton("IMDb", () => openExternal(imdbUrl))
        );
      }

      if (tmdbUrl) {
        actions.append(
          createButton("TMDB", () => openExternal(tmdbUrl))
        );
      }

      const catalogUrls = VidCoreMetadata.externalCatalogUrls(entry, entry);
      for (const [label, url] of [
        ["FastFlix", catalogUrls.fastflix],
        ["SeeFlix", catalogUrls.seeflix],
        ["123Movies", catalogUrls.movies123]
      ]) {
        if (url) actions.append(createButton(label, () => openExternal(url)));
      }
    }

    if (options.save) {
      actions.append(
        createButton("Save", () => openSaveDialog(entry))
      );
    }

    if (options.edit) {
      actions.append(
        createButton("Edit", () => openSaveDialog(entry))
      );
    }

    if (options.complete) {
      actions.append(
        createButton(
          entry.completed ? "Resume" : "Finished",
          () => setHistoryCompleted(entry, !entry.completed)
        )
      );
    }

    if (options.toggleWatched) {
      actions.append(
        createButton(
          entry.watched ? "Unwatch" : "Watched",
          () => toggleFavoriteWatched(entry)
        )
      );
    }


    body.append(actions);
    card.append(poster, body);
    return card;
  }

  function emptyCard(message) {
    const empty = document.createElement("div");
    empty.className = "empty-card";
    empty.textContent = message;
    return empty;
  }

  async function listData() {
    const [lists, favorites] = await Promise.all([
      VidCoreStorage.getAll(VidCoreStorage.STORES.lists),
      VidCoreStorage.getAll(VidCoreStorage.STORES.favorites)
    ]);

    lists.sort((left, right) => {
      if (left.name === "Favorites") return -1;
      if (right.name === "Favorites") return 1;
      return left.name.localeCompare(right.name);
    });

    return { lists, favorites };
  }

  async function renderListControls() {
    if (!state.storageReady) return;

    const { lists, favorites } = await listData();
    const customNames = lists
      .map(list => list.name)
      .filter(name => name !== "Favorites");
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

  function filterLibraryEntries(entries) {
    const search = elements.librarySearch.value
      .trim()
      .toLocaleLowerCase();

    return entries
      .filter(entry =>
        state.selectedList === "All" ||
        entry.list === state.selectedList
      )
      .filter(entry => {
        if (!search) return true;
        return [
          entry.title,
          entry.id,
          entry.notes,
          entry.list,
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

  async function renderLibrary() {
    if (!state.storageReady) {
      elements.libraryCards.replaceChildren(
        emptyCard("Library storage is starting…")
      );
      return;
    }

    const entries = filterLibraryEntries(
      await VidCoreStorage.getAll(
        VidCoreStorage.STORES.favorites
      )
    );

    elements.libraryCards.replaceChildren();

    if (entries.length === 0) {
      elements.libraryCards.append(
        emptyCard("No saved titles match this list and filter.")
      );
      return;
    }

    for (const entry of entries) {
      elements.libraryCards.append(
        createMediaCard(entry, {
          edit: true,
          links: true,
          toggleWatched: true
        })
      );
    }
  }

  async function renderFavorites() {
    if (!state.storageReady) {
      elements.favoritesCards.replaceChildren(
        emptyCard("Library storage is starting…")
      );
      return;
    }

    const entries = (
      await VidCoreStorage.getAll(
        VidCoreStorage.STORES.favorites
      )
    )
      .filter(entry => entry.list === "Favorites")
      .sort((left, right) =>
        String(right.updatedAt || right.createdAt || "")
          .localeCompare(
            String(left.updatedAt || left.createdAt || "")
          )
      );

    elements.favoritesCards.replaceChildren();

    if (entries.length === 0) {
      elements.favoritesCards.append(
        emptyCard("Save a title to Favorites to keep it here permanently.")
      );
      return;
    }

    for (const entry of entries) {
      elements.favoritesCards.append(
        createMediaCard(entry, {
          edit: true,
          links: true,
          toggleWatched: true
        })
      );
    }
  }

  async function renderContinueWatching() {
    if (!state.storageReady) return;

    const entries = (
      await VidCoreStorage.getAll(
        VidCoreStorage.STORES.history
      )
    )
      .filter(entry => !entry.completed)
      .sort((left, right) =>
        String(right.lastPlayedAt || "")
          .localeCompare(String(left.lastPlayedAt || ""))
      );

    elements.continueCards.replaceChildren();

    if (entries.length === 0) {
      elements.continueCards.append(
        emptyCard("Play something to add it to Continue Watching.")
      );
      return;
    }

    for (const entry of entries) {
      elements.continueCards.append(
        createMediaCard(entry, {
          save: true,
          links: true,
          complete: true,
          source: formatDate(entry.lastPlayedAt)
        })
      );
    }
  }

  function renderRecommended() {
    const entries = state.scanner?.readQueue() ||
      VidCoreScanner.readQueue();

    elements.recommendedCards.replaceChildren();

    if (entries.length === 0) {
      elements.recommendedCards.append(
        emptyCard(
          "Resolved titles with cover art appear here automatically, even when they are not saved."
        )
      );
      return;
    }

    for (const entry of entries) {
      elements.recommendedCards.append(
        createMediaCard(entry, {
          save: true,
          links: true,
          source: "Discovered"
        })
      );
    }
  }

  function renderRelated() {
    elements.relatedCards.replaceChildren();

    if (state.related.length === 0) {
      elements.relatedCards.append(
        emptyCard("Resolve a title to load related movies or TV.")
      );
      return;
    }

    for (const entry of state.related) {
      elements.relatedCards.append(
        createMediaCard(entry, {
          save: true,
          links: true,
          source: "Related"
        })
      );
    }
  }

  function renderBlocked() {
    elements.blockedCards.replaceChildren();

    if (state.blocked.length === 0) {
      elements.blockedCards.append(
        emptyCard("New popup attempts caught this run appear here.")
      );
      return;
    }

    for (const item of state.blocked) {
      const card = document.createElement("article");
      card.className = "blocked-card";

      const kind = document.createElement("strong");
      kind.textContent = item.kind || "blocked";

      const url = document.createElement("span");
      url.textContent = item.url || "Unknown address";

      card.append(kind, url);
      elements.blockedCards.append(card);
    }
  }

  async function openSaveDialog(entry = null) {
    if (!state.storageReady) return;

    await renderListControls();

    const target = VidCoreMetadata.normalizeEntry(
      entry || currentEntry()
    );
    const key = VidCoreMetadata.entryKey(target);
    const existing = await VidCoreStorage.get(
      VidCoreStorage.STORES.favorites,
      key
    );

    state.editingKey = key;
    state.dialogEntry = {
      ...(entry || {}),
      ...target
    };
    elements.saveDialogTitle.textContent = existing
      ? "Edit library item"
      : "Save to library";
    elements.saveList.value =
      existing?.list ||
      (state.activePanel === "favorites"
        ? "Favorites"
        : state.selectedList !== "All"
          ? state.selectedList
          : "Favorites");
    elements.deleteDialogButton.classList.toggle("hidden", !existing);
    elements.saveNotes.value = existing?.notes || "";
    elements.saveWatched.checked = Boolean(existing?.watched);
    elements.saveDialog.showModal();
  }

  async function saveDialogEntry() {
    const source = state.dialogEntry || currentEntry();
    const entry = VidCoreMetadata.normalizeEntry(source);
    const key = VidCoreMetadata.entryKey(entry);
    const existing = await VidCoreStorage.get(
      VidCoreStorage.STORES.favorites,
      key
    );

    const metadata = source.resolutionStatus === "resolved"
      ? source
      : state.currentMetadataKey === key
        ? state.currentMetadata
        : null;
    const now = new Date().toISOString();

    await VidCoreStorage.put(
      VidCoreStorage.STORES.favorites,
      {
        ...existing,
        ...entry,
        ...(metadata || {}),
        key,
        title:
          metadata?.title ||
          existing?.title ||
          VidCoreMetadata.fallbackTitle(entry),
        list: elements.saveList.value || "Favorites",
        notes: elements.saveNotes.value.trim(),
        watched: elements.saveWatched.checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      }
    );

    const cachedImage = await requestNativeArtwork(entry, {
      ...existing,
      ...(metadata || {})
    });
    if (cachedImage) {
      const saved = await VidCoreStorage.get(
        VidCoreStorage.STORES.favorites,
        key
      );
      if (saved) {
        await VidCoreStorage.put(
          VidCoreStorage.STORES.favorites,
          {
            ...saved,
            image: cachedImage,
            artworkSource: "IMDb/TMDB local cache",
            updatedAt: new Date().toISOString()
          }
        );
      }
    }

    if (elements.saveWatched.checked) {
      const history = await VidCoreStorage.get(
        VidCoreStorage.STORES.history,
        key
      );
      if (history) {
        await VidCoreStorage.put(
          VidCoreStorage.STORES.history,
          {
            ...history,
            completed: true
          }
        );
      }
    }

    elements.saveDialog.close();
    state.dialogEntry = null;
    state.editingKey = "";
    await renderAllLibraryViews();
    setStatus("Library updated", "The title was saved.", "ok");
  }

  async function deleteFavorite(entry) {
    const key = entry.key || VidCoreMetadata.entryKey(entry);
    await VidCoreStorage.remove(
      VidCoreStorage.STORES.favorites,
      key
    );
    const identity = mediaCacheIdentity(entry, entry);
    const remainingFavorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    if (!remainingFavorites.some(candidate =>
      mediaCacheIdentity(candidate, candidate) === identity
    )) {
      postHost(`delete-image-cache|${identity}`);
    }
    if (elements.saveDialog.open) {
      elements.saveDialog.close();
    }
    state.dialogEntry = null;
    state.editingKey = "";
    await renderAllLibraryViews();
    setStatus(
      "Removed from library",
      entry.title || VidCoreMetadata.fallbackTitle(entry),
      "ok"
    );
  }

  async function toggleFavoriteWatched(entry) {
    const watched = !entry.watched;
    await VidCoreStorage.put(
      VidCoreStorage.STORES.favorites,
      {
        ...entry,
        watched,
        updatedAt: new Date().toISOString()
      }
    );

    const history = await VidCoreStorage.get(
      VidCoreStorage.STORES.history,
      entry.key
    );

    if (history) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.history,
        {
          ...history,
          completed: watched
        }
      );
    }

    await renderAllLibraryViews();
  }

  async function setHistoryCompleted(entry, completed) {
    await VidCoreStorage.put(
      VidCoreStorage.STORES.history,
      {
        ...entry,
        completed
      }
    );
    await renderContinueWatching();
  }

  async function addList() {
    const name = elements.newListName.value.trim();
    if (!name) {
      setStatus("List name required", "Enter a name first.", "warn");
      return;
    }

    if (RESERVED_LISTS.has(name.toLocaleLowerCase())) {
      setStatus(
        "Reserved list name",
        "Choose a name other than All, Favorites, Continue, Recommended, Related, or Blocked.",
        "warn"
      );
      return;
    }

    const lists = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.lists
    );

    if (lists.some(
      list => list.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )) {
      setStatus("List already exists", name, "warn");
      return;
    }

    await VidCoreStorage.put(
      VidCoreStorage.STORES.lists,
      {
        name,
        createdAt: new Date().toISOString()
      }
    );

    elements.newListName.value = "";
    state.selectedList = name;
    await renderListControls();
    await renderLibrary();
    setStatus("List created", name, "ok");
  }

  async function selectedFavorites() {
    const entries = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );

    return state.selectedList === "All"
      ? entries
      : entries.filter(entry => entry.list === state.selectedList);
  }

  async function resolveSelectedList() {
    const entries = await selectedFavorites();

    if (entries.length === 0) {
      setStatus("Nothing to resolve", "The selected list is empty.", "warn");
      return;
    }

    elements.resolveListButton.disabled = true;

    try {
      let completed = 0;
      await VidCoreMetadata.resolveMany(
        entries,
        3,
        async (entry, metadata) => {
          const officialMetadata = await preferOfficialArtwork(entry, metadata);
          await VidCoreStorage.put(
            VidCoreStorage.STORES.favorites,
            {
              ...entry,
              ...officialMetadata,
              updatedAt: new Date().toISOString()
            }
          );
          state.scanner?.addResolvedImage({
            ...entry,
            ...officialMetadata
          });
          completed += 1;
          setStatus(
            "Resolving list",
            `${completed} of ${entries.length} complete…`
          );
        }
      );

      await renderAllLibraryViews();
      renderRecommended();
      setStatus(
        "List resolved",
        `${entries.length} item${entries.length === 1 ? "" : "s"} updated.`,
        "ok"
      );
    } catch (error) {
      setStatus("List resolution stopped", error.message, "error");
    } finally {
      elements.resolveListButton.disabled = false;
    }
  }

  async function markSelectedListWatched() {
    const entries = await selectedFavorites();

    for (const entry of entries) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.favorites,
        {
          ...entry,
          watched: true,
          updatedAt: new Date().toISOString()
        }
      );

      const history = await VidCoreStorage.get(
        VidCoreStorage.STORES.history,
        entry.key
      );

      if (history) {
        await VidCoreStorage.put(
          VidCoreStorage.STORES.history,
          {
            ...history,
            completed: true
          }
        );
      }
    }

    await renderAllLibraryViews();
    setStatus(
      "Marked watched",
      `${entries.length} item${entries.length === 1 ? "" : "s"} updated.`,
      "ok"
    );
  }

  async function renderAllLibraryViews() {
    await Promise.all([
      renderListControls(),
      renderLibrary(),
      renderFavorites(),
      renderContinueWatching()
    ]);
  }

  async function exportBackup() {
    try {
      const payload = await VidCoreStorage.exportData({
        discoveryQueue: VidCoreScanner.readQueue(),
        settings: {
          baseUrl: elements.baseUrl.value,
          mode: elements.mode.value,
          mediaId: elements.mediaId.value,
          season: elements.season.value,
          episode: elements.episode.value,
          randomMode: elements.randomMode.value
        }
      });

      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vidcore-native-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Backup exported", anchor.download, "ok");
    } catch (error) {
      setStatus("Export failed", error.message, "error");
    }
  }

  async function importBackup(file) {
    try {
      const payload = JSON.parse(await file.text());
      const result = await VidCoreStorage.importData(payload);

      if (Array.isArray(payload.discoveryQueue)) {
        localStorage.setItem(
          "vidcoreLibrary.discoveryQueue",
          JSON.stringify(payload.discoveryQueue.slice(0, 40))
        );
      }

      if (payload.settings) {
        elements.baseUrl.value =
          payload.settings.baseUrl || elements.baseUrl.value;
        elements.mode.value =
          payload.settings.mode || elements.mode.value;
        elements.mediaId.value =
          payload.settings.mediaId || elements.mediaId.value;
        elements.season.value =
          payload.settings.season || elements.season.value;
        elements.episode.value =
          payload.settings.episode || elements.episode.value;
        elements.randomMode.value =
          payload.settings.randomMode || "database";
        syncModeFields();
      }

      await renderAllLibraryViews();
      renderRecommended();
      await pruneNativeArtworkCache();

      setStatus(
        "Backup imported",
        `${result.favorites} favorites, ${result.lists} lists, ${result.history} history entries.`,
        "ok"
      );
    } catch (error) {
      setStatus("Import failed", error.message, "error");
    } finally {
      elements.importFile.value = "";
    }
  }

  function setScanning(scanning) {
    const text = scanning ? "Stop scan" : null;
    elements.previousButton.textContent = text || "Previous";
    elements.nextButton.textContent = text || "Next";
    elements.randomButton.textContent = text || "Random";
  }

  function toggleTheater() {
    state.theater = !state.theater;
    document.body.classList.toggle("theater", state.theater);
    elements.theaterModeButton.textContent =
      state.theater ? "Exit theater" : "Theater";
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await elements.playerShell.requestFullscreen();
      }
    } catch (error) {
      setStatus("Fullscreen failed", error.message, "error");
    }
  }

  function applyZoom() {
    const percent = Number(elements.zoomSlider.value);
    elements.zoomOutput.textContent = `${percent}%`;
    postHost(`zoom|${(percent / 100).toFixed(2)}`);
  }

  function changeZoom(delta) {
    elements.zoomSlider.value = String(
      Math.max(
        50,
        Math.min(
          200,
          Number(elements.zoomSlider.value) + delta
        )
      )
    );
    applyZoom();
  }

  function handleHostMessage(message) {
    const text = String(message);
    const first = text.indexOf("|");
    const command = first < 0 ? text : text.slice(0, first);
    const payload = first < 0 ? "" : text.slice(first + 1);

    if (command === "blocked-count") {
      return;
    }

    if (command === "blocked") {
      const second = payload.indexOf("|");
      const kind = second < 0
        ? payload
        : payload.slice(0, second);
      const url = second < 0
        ? ""
        : payload.slice(second + 1);

      state.blocked = [
        { kind, url },
        ...state.blocked
      ].slice(0, 100);
      renderBlocked();
      setStatus("Popup blocked", url || kind, "ok");
      return;
    }

    if (command === "image-resolved") {
      const second = payload.indexOf("|");
      const requestId = second < 0 ? payload : payload.slice(0, second);
      const remainder = second < 0 ? "" : payload.slice(second + 1);
      const third = remainder.indexOf("|");
      const image = third < 0 ? remainder : remainder.slice(0, third);
      const pending = state.artworkRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        state.artworkRequests.delete(requestId);
        pending.resolve(image || "");
      }
      return;
    }

    if (command === "blocked-cleared") {
      state.blocked = [];
      renderBlocked();
      setStatus(
        "Learned hosts cleared",
        "The shield will learn future popup hosts again.",
        "ok"
      );
      return;
    }

    if (command === "muted") {
      state.muted = payload === "1";
      elements.muteButton.textContent =
        state.muted ? "Unmute" : "Mute";
      return;
    }

    if (command === "zoom") {
      const percent = Math.round(
        (Number(payload) || 1) * 100
      );
      elements.zoomSlider.value = String(percent);
      elements.zoomOutput.textContent = `${percent}%`;
      return;
    }

    if (command === "external-denied") {
      setStatus(
        "External link blocked",
        payload,
        "warn"
      );
    }
  }

  async function migrateLegacyData() {
    const favoriteKeys = [
      "vidcore.native.favorites",
      "vidcoreLargePlayer.favorites"
    ];
    const recentKeys = [
      "vidcore.native.recent"
    ];

    let migratedFavorites = 0;
    let migratedHistory = 0;

    for (const storageKey of favoriteKeys) {
      let entries = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
        entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        entries = [];
      }

      for (const raw of entries) {
        try {
          const entry = VidCoreMetadata.normalizeEntry({
            baseUrl: raw.baseUrl || raw.provider || "https://vidcore.net",
            mode: raw.mode || raw.type || "movie",
            id: raw.id || "1",
            season: raw.season || 1,
            episode: raw.episode || 1
          });
          const key = VidCoreMetadata.entryKey(entry);
          const existing = await VidCoreStorage.get(
            VidCoreStorage.STORES.favorites,
            key
          );

          if (!existing) {
            await VidCoreStorage.put(
              VidCoreStorage.STORES.favorites,
              {
                ...raw,
                ...entry,
                key,
                title:
                  raw.title ||
                  VidCoreMetadata.fallbackTitle(entry),
                list: raw.list || "Favorites",
                notes: raw.notes || "",
                watched: Boolean(raw.watched),
                createdAt:
                  raw.createdAt ||
                  new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            );
            migratedFavorites += 1;
          }
        } catch {
        }
      }

      if (entries.length) {
        localStorage.removeItem(storageKey);
      }
    }

    for (const storageKey of recentKeys) {
      let entries = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
        entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        entries = [];
      }

      for (const raw of entries) {
        try {
          const entry = VidCoreMetadata.normalizeEntry({
            baseUrl: raw.baseUrl || raw.provider || "https://vidcore.net",
            mode: raw.mode || raw.type || "movie",
            id: raw.id || "1",
            season: raw.season || 1,
            episode: raw.episode || 1
          });
          const key = VidCoreMetadata.entryKey(entry);
          const existing = await VidCoreStorage.get(
            VidCoreStorage.STORES.history,
            key
          );

          if (!existing) {
            await VidCoreStorage.put(
              VidCoreStorage.STORES.history,
              {
                ...raw,
                ...entry,
                key,
                title:
                  raw.title ||
                  VidCoreMetadata.fallbackTitle(entry),
                lastPlayedAt:
                  raw.lastPlayedAt ||
                  raw.timestamp ||
                  new Date().toISOString(),
                completed: Boolean(raw.completed)
              }
            );
            migratedHistory += 1;
          }
        } catch {
        }
      }

      if (entries.length) {
        localStorage.removeItem(storageKey);
      }
    }

    return {
      favorites: migratedFavorites,
      history: migratedHistory
    };
  }


  async function sanitizeStoredArtwork() {
    if (!state.storageReady) return { favorites: 0, history: 0, queue: 0 };

    let favorites = 0;
    let history = 0;
    for (const store of [
      VidCoreStorage.STORES.favorites,
      VidCoreStorage.STORES.history
    ]) {
      for (const entry of await VidCoreStorage.getAll(store)) {
        if (!entry.image || !VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)) {
          continue;
        }
        const cleaned = { ...entry, image: "", artworkRejectedAt: new Date().toISOString() };
        await VidCoreStorage.put(store, cleaned);
        if (store === VidCoreStorage.STORES.favorites) favorites += 1;
        else history += 1;
      }
    }

    const queue = VidCoreScanner.readQueue();
    const cleanedQueue = queue.filter(entry =>
      entry.image && !VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)
    );
    if (cleanedQueue.length !== queue.length) {
      localStorage.setItem(
        "vidcoreLibrary.discoveryQueue",
        JSON.stringify(cleanedQueue.slice(0, 40))
      );
    }

    return { favorites, history, queue: queue.length - cleanedQueue.length };
  }

  async function initializeStorage() {
    try {
      await VidCoreStorage.initialize();
      state.storageReady = true;
      const migration = await migrateLegacyData();
      const artworkCleanup = await sanitizeStoredArtwork();
      elements.storageMode.textContent =
        VidCoreStorage.mode === "indexeddb"
          ? "IndexedDB storage active"
          : "localStorage fallback active";

      await renderAllLibraryViews();
      await pruneNativeArtworkCache();
      const migrated = migration.favorites + migration.history;
      const rejectedArtwork = artworkCleanup.favorites + artworkCleanup.history + artworkCleanup.queue;
      setStatus(
        "Library ready",
        [
          elements.storageMode.textContent,
          migrated ? `migrated ${migrated} older entr${migrated === 1 ? "y" : "ies"}` : "",
          rejectedArtwork ? `removed ${rejectedArtwork} mismatched artwork image${rejectedArtwork === 1 ? "" : "s"}` : ""
        ].filter(Boolean).join("; "),
        "ok"
      );
    } catch (error) {
      elements.storageMode.textContent = "Storage unavailable";
      setStatus("Storage failed", error.message, "error");
    }
  }

  function bindEvents() {
    elements.mode.addEventListener("change", () => {
      syncModeFields();
      resetCurrentMetadataIfChanged();
    });

    for (const input of [
      elements.baseUrl,
      elements.mediaId,
      elements.season,
      elements.episode
    ]) {
      input.addEventListener(
        "change",
        resetCurrentMetadataIfChanged
      );
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          play();
        }
      });
    }

    elements.playButton.addEventListener("click", () => play());
    elements.randomMode.addEventListener("change", () => {
      localStorage.setItem(
        `${SETTINGS_PREFIX}randomMode`,
        elements.randomMode.value
      );
    });

    elements.previousButton.addEventListener("click", () => {
      if (state.scanner.scanning) {
        state.scanner.cancel();
      } else {
        state.scanner.scanNeighbor(-1);
      }
    });

    elements.nextButton.addEventListener("click", () => {
      if (state.scanner.scanning) {
        state.scanner.cancel();
      } else {
        state.scanner.scanNeighbor(1);
      }
    });

    elements.randomButton.addEventListener("click", () => {
      if (state.scanner.scanning) {
        state.scanner.cancel();
      } else {
        state.scanner.random(elements.randomMode.value);
      }
    });

    elements.resolveButton.addEventListener(
      "click",
      () => resolveCurrent()
    );
    elements.favoriteButton.addEventListener(
      "click",
      () => openSaveDialog()
    );

    elements.imdbButton.addEventListener(
      "click",
      () => openExternal(elements.imdbButton.dataset.url)
    );
    elements.tmdbButton.addEventListener(
      "click",
      () => openExternal(elements.tmdbButton.dataset.url)
    );
    elements.wikipediaButton.addEventListener(
      "click",
      () => openExternal(elements.wikipediaButton.dataset.url)
    );
    for (const button of [
      elements.fastflixButton,
      elements.seeflixButton,
      elements.movies123Button
    ]) {
      button.addEventListener("click", () => openExternal(button.dataset.url));
    }

    elements.stopButton.addEventListener("click", stopPlayer);
    elements.copyUrlButton.addEventListener("click", copyPlayerUrl);
    elements.muteButton.addEventListener(
      "click",
      () => postHost(`mute|${state.muted ? 0 : 1}`)
    );
    elements.theaterModeButton.addEventListener(
      "click",
      toggleTheater
    );
    elements.fullscreenButton.addEventListener(
      "click",
      toggleFullscreen
    );
    elements.devtoolsButton.addEventListener(
      "click",
      () => postHost("devtools")
    );
    elements.zoomOutButton.addEventListener(
      "click",
      () => changeZoom(-10)
    );
    elements.zoomInButton.addEventListener(
      "click",
      () => changeZoom(10)
    );
    elements.zoomSlider.addEventListener("input", applyZoom);
    elements.reloadShellButton.addEventListener(
      "click",
      () => postHost("reload-shell")
    );
    elements.dataFolderButton.addEventListener(
      "click",
      () => postHost("open-data-folder")
    );

    elements.shieldHelpButton.addEventListener(
      "click",
      () => elements.shieldDialog.showModal()
    );
    elements.storageInfoButton.addEventListener(
      "click",
      () => elements.storageDialog.showModal()
    );
    elements.closeShieldDialogButton.addEventListener(
      "click",
      () => elements.shieldDialog.close()
    );
    elements.closeStorageDialogButton.addEventListener(
      "click",
      () => elements.storageDialog.close()
    );

    for (const tab of elements.tabs) {
      tab.addEventListener(
        "click",
        () => showPanel(tab.dataset.panel)
      );
    }

    elements.librarySearch.addEventListener(
      "input",
      renderLibrary
    );
    elements.addListButton.addEventListener("click", addList);
    elements.newListName.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        addList();
      }
    });
    elements.resolveListButton.addEventListener(
      "click",
      resolveSelectedList
    );
    elements.markListWatchedButton.addEventListener(
      "click",
      markSelectedListWatched
    );

    elements.saveForm.addEventListener("submit", event => {
      event.preventDefault();
      saveDialogEntry().catch(error =>
        setStatus("Save failed", error.message, "error")
      );
    });
    elements.cancelSaveButton.addEventListener(
      "click",
      () => {
        state.dialogEntry = null;
        state.editingKey = "";
        elements.saveDialog.close();
      }
    );
    elements.deleteDialogButton.addEventListener(
      "click",
      () => {
        if (!state.dialogEntry) return;
        deleteFavorite(state.dialogEntry).catch(error =>
          setStatus("Delete failed", error.message, "error")
        );
      }
    );

    elements.exportButton.addEventListener(
      "click",
      exportBackup
    );
    elements.importButton.addEventListener(
      "click",
      () => elements.importFile.click()
    );
    elements.importFile.addEventListener("change", () => {
      const file = elements.importFile.files?.[0];
      if (file) {
        importBackup(file);
      }
    });

    elements.clearBlockedButton.addEventListener(
      "click",
      () => postHost("clear-blocklist")
    );

    globalThis.chrome?.webview?.addEventListener(
      "message",
      event => handleHostMessage(event.data)
    );

    document.addEventListener("keydown", event => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "[") {
        state.scanner.scanNeighbor(-1);
      } else if (event.key === "]") {
        state.scanner.scanNeighbor(1);
      } else if (event.key.toLowerCase() === "r") {
        state.scanner.random(elements.randomMode.value);
      } else if (event.key.toLowerCase() === "t") {
        toggleTheater();
      } else if (event.key.toLowerCase() === "m") {
        postHost(`mute|${state.muted ? 0 : 1}`);
      } else if (event.key === "Escape" && state.theater) {
        toggleTheater();
      }
    });
  }

  async function start() {
    restoreSettings();
    renderCurrent(
      currentEntrySafe(),
      emptyMetadata(currentEntrySafe())
    );
    renderRelated();
    renderBlocked();

    state.scanner = VidCoreScanner.create({
      currentEntry,
      resolve: resolveEntry,
      play,
      status: setStatus,
      onScanningChanged: setScanning,
      onDiscovered: renderRecommended
    });

    renderRecommended();
    bindEvents();
    postHost("ready");
    await initializeStorage();
  }

  start().catch(error =>
    setStatus("Application startup failed", error.message, "error")
  );
})();
