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
    youtubeButton: $("#youtubeButton"),
    seriesNextButton: $("#seriesNextButton"),
    fastflixButton: $("#fastflixButton"),
    seeflixButton: $("#seeflixButton"),
    movies123Button: $("#movies123Button"),
    playerShell: $("#playerShell"),
    player: $("#player"),
    emptyPlayer: $("#emptyPlayer"),
    stopButton: $("#stopButton"),
    copyUrlButton: $("#copyUrlButton"),
    muteButton: $("#muteButton"),
    volumeSlider: $("#volumeSlider"),
    volumeOutput: $("#volumeOutput"),
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
    saveNewListName: $("#saveNewListName"),
    saveAddListButton: $("#saveAddListButton"),
    resolveListButton: $("#resolveListButton"),
    markListWatchedButton: $("#markListWatchedButton"),
    deleteListButton: $("#deleteListButton"),
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
    saveTitle: $("#saveTitle"),
    saveList: $("#saveList"),
    saveNotes: $("#saveNotes"),
    saveFavorite: $("#saveFavorite"),
    saveWatched: $("#saveWatched"),
    saveNextEnabled: $("#saveNextEnabled"),
    saveNextFields: $("#saveNextFields"),
    saveNextProvider: $("#saveNextProvider"),
    saveNextMode: $("#saveNextMode"),
    saveNextTitle: $("#saveNextTitle"),
    saveNextId: $("#saveNextId"),
    saveNextSeasonField: $("#saveNextSeasonField"),
    saveNextEpisodeField: $("#saveNextEpisodeField"),
    saveNextSeason: $("#saveNextSeason"),
    saveNextEpisode: $("#saveNextEpisode"),
    cancelSaveButton: $("#cancelSaveButton"),
    deleteDialogButton: $("#deleteDialogButton"),
    storageDialog: $("#storageDialog"),
    closeStorageDialogButton: $("#closeStorageDialogButton"),
    shieldDialog: $("#shieldDialog"),
    extensionStatus: $("#extensionStatus"),
    closeShieldDialogButton: $("#closeShieldDialogButton"),
  };

  const state = {
    storageReady: false,
    selectedList: "All",
    currentMetadata: null,
    currentMetadataKey: "",
    related: [],
    relatedLoading: false,
    activePanel: "library",
    blocked: [],
    muted: false,
    volume: 100,
    theater: false,
    editingKey: "",
    dialogEntry: null,
    scanner: null,
    artworkSequence: 0,
    artworkRequests: new Map(),
    localArtworkCache: new Map()
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

  function isFavoriteEntry(entry) {
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
        mode: elements.mode.value === "youtube"
          ? "youtube"
          : elements.mode.value === "tv"
            ? "tv"
            : "movie",
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
    elements.mode.value = entry.mode === "youtube"
      ? "youtube"
      : entry.mode === "tv"
        ? "tv"
        : "movie";
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
    const savedVolume = Number(
      localStorage.getItem(`${SETTINGS_PREFIX}volume`) || "100"
    );
    elements.volumeSlider.value = String(
      Math.max(0, Math.min(100, Number.isFinite(savedVolume) ? savedVolume : 100))
    );
    state.volume = Number(elements.volumeSlider.value);
    elements.volumeOutput.textContent = `${state.volume}%`;
    syncModeFields();
  }

  function syncModeFields() {
    const television = elements.mode.value === "tv";
    const youtube = elements.mode.value === "youtube";
    elements.seasonField.classList.toggle("hidden", !television);
    elements.episodeField.classList.toggle("hidden", !television);
    if (youtube) {
      elements.baseUrl.value = "https://www.youtube.com";
    } else if (elements.baseUrl.value === "https://www.youtube.com") {
      elements.baseUrl.value = "https://vidcore.net";
    }
  }

  function emptyMetadata(entry) {
    return {
      title: VidCoreMetadata.fallbackTitle(entry),
      description:
        "Play directly, resolve metadata, or scan to a verified public identifier.",
      year: "",
      image: "",
      imdb: /^tt\d+$/i.test(entry.id) ? entry.id : "",
      tmdb: entry.mode !== "youtube" && /^\d+$/.test(entry.id) ? entry.id : "",
      youtube: entry.mode === "youtube" ? entry.id : "",
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

  function setEntryPoster(container, entry, metadata, fallback, guard = () => true) {
    const remoteImage = VidCoreMetadata.isLikelyBadArtwork(entry, metadata, metadata.image)
      ? ""
      : metadata.image;
    setPoster(container, remoteImage, fallback);
    requestNativeArtwork(entry, metadata).then(image => {
      if (image && guard()) setPoster(container, image, fallback);
    }).catch(() => {});
  }

  function renderCurrent(entry, metadata) {
    elements.currentType.textContent = entry.mode === "youtube"
      ? "YouTube"
      : entry.mode === "movie"
        ? "Movie"
        : `TV · Season ${entry.season} · Episode ${entry.episode}`;
    elements.currentTitle.textContent =
      metadata.title || VidCoreMetadata.fallbackTitle(entry);
    elements.currentDescription.textContent =
      metadata.description ||
      "No description is available for this identifier.";

    setEntryPoster(
      elements.currentPoster,
      entry,
      metadata,
      entry.mode === "youtube" ? "YT" : entry.mode === "movie" ? "M" : "TV",
      () => isCurrentEntry(entry)
    );

    elements.currentMeta.replaceChildren();
    const metadataValues = [
      metadata.year,
      metadata.resolutionStatus === "resolved" ? "Resolved" : "Unresolved",
      metadata.imdb ? `IMDb ${metadata.imdb}` : "",
      metadata.tmdb ? `TMDB ${metadata.tmdb}` : "",
      metadata.youtube ? `YouTube ${metadata.youtube}` : ""
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
    const youtubeUrl = VidCoreMetadata.youtubeUrl(entry);
    const wikipediaUrl = entry.mode === "youtube"
      ? ""
      : metadata.wikipedia || metadata.article || "";
    const seriesNext = metadata?.next?.id ? metadata.next : null;

    elements.imdbButton.classList.toggle("hidden", !imdbUrl);
    elements.tmdbButton.classList.toggle("hidden", !tmdbUrl);
    elements.wikipediaButton.classList.toggle("hidden", !wikipediaUrl);
    elements.youtubeButton.classList.toggle("hidden", !youtubeUrl);
    elements.seriesNextButton.classList.toggle("hidden", !seriesNext);

    elements.imdbButton.dataset.url = imdbUrl;
    elements.tmdbButton.dataset.url = tmdbUrl;
    elements.wikipediaButton.dataset.url = wikipediaUrl;
    elements.youtubeButton.dataset.url = youtubeUrl;
    elements.seriesNextButton.title = seriesNext?.title
      ? `Play ${seriesNext.title}`
      : "Play the saved next video in this series";

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

  function normalizedGenreSet(entry) {
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
      applyVolume(false);
      setTimeout(() => applyVolume(false), 700);
      setTimeout(() => applyVolume(false), 1800);

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
      ensureRelated().catch(error =>
        setStatus("Related lookup failed", error.message, "warn")
      );
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
    setEntryPoster(
      poster,
      entry,
      entry,
      entry.mode === "movie" ? "M" : "TV",
      () => card.isConnected
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
      entry.mode === "youtube"
        ? "YouTube"
        : entry.mode === "movie"
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
      const youtubeUrl = VidCoreMetadata.youtubeUrl(entry);

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

      if (youtubeUrl) {
        actions.append(
          createButton("YouTube", () => openExternal(youtubeUrl))
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

  function filterLibraryEntries(entries) {
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
      .filter(isFavoriteEntry)
      .sort((left, right) =>
        String(right.updatedAt || right.createdAt || "")
          .localeCompare(
            String(left.updatedAt || left.createdAt || "")
          )
      );

    elements.favoritesCards.replaceChildren();

    if (entries.length === 0) {
      elements.favoritesCards.append(
        emptyCard("Mark titles as Favorites without removing their category.")
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
        emptyCard(state.relatedLoading
          ? "Loading related titles…"
          : "Open Related to resolve the current title and compare it with your library.")
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

  function syncNextFields() {
    const enabled = elements.saveNextEnabled.checked;
    const television = elements.saveNextMode.value === "tv";
    const youtube = elements.saveNextMode.value === "youtube";
    elements.saveNextFields.classList.toggle("hidden", !enabled);
    elements.saveNextSeasonField.classList.toggle("hidden", !enabled || !television);
    elements.saveNextEpisodeField.classList.toggle("hidden", !enabled || !television);
    if (youtube) {
      elements.saveNextProvider.value = "https://www.youtube.com";
    } else if (elements.saveNextProvider.value === "https://www.youtube.com") {
      elements.saveNextProvider.value = "https://vidcore.net";
    }
  }

  function nextEntryFromDialog() {
    if (!elements.saveNextEnabled.checked) return null;
    if (!elements.saveNextId.value.trim()) {
      throw new Error("Enter the next video's media ID or turn off next-in-series.");
    }
    const next = VidCoreMetadata.normalizeEntry({
      baseUrl: elements.saveNextProvider.value,
      mode: elements.saveNextMode.value,
      id: elements.saveNextId.value,
      season: elements.saveNextSeason.value,
      episode: elements.saveNextEpisode.value
    });
    const title = elements.saveNextTitle.value.trim();
    return title ? { ...next, title } : next;
  }

  async function playSeriesNext() {
    let source = state.currentMetadata;
    if (state.storageReady) {
      try {
        const saved = await VidCoreStorage.get(
          VidCoreStorage.STORES.favorites,
          VidCoreMetadata.entryKey(currentEntry())
        );
        if (saved) source = { ...(source || {}), ...saved };
      } catch {
      }
    }

    if (!source?.next?.id) {
      setStatus("No series next", "Add the next video in Edit/Save first.", "warn");
      return;
    }

    const target = VidCoreMetadata.normalizeEntry(source.next);
    const saved = state.storageReady
      ? await VidCoreStorage.get(
          VidCoreStorage.STORES.favorites,
          VidCoreMetadata.entryKey(target)
        )
      : null;
    const manual = source.next.title
      ? {
          ...emptyMetadata(target),
          ...source.next,
          title: source.next.title,
          description: `Next in series after ${source.title || "the current title"}`,
          resolutionStatus: "manual"
        }
      : null;

    await play(
      target,
      saved?.resolutionStatus === "resolved" ? saved : manual
    );
    if (!saved?.resolutionStatus || saved.resolutionStatus !== "resolved") {
      resolveEntry(target, true).catch(() => {});
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
    const sourceMetadata = existing || entry ||
      (state.currentMetadataKey === key ? state.currentMetadata : null) || {};
    elements.saveTitle.value =
      sourceMetadata.title || VidCoreMetadata.fallbackTitle(target);
    const category = existing
      ? categoryForEntry(existing)
      : state.selectedList !== "All" && state.selectedList !== "Favorites"
        ? state.selectedList
        : "Uncategorized";
    elements.saveList.value = category;
    if (!elements.saveList.value) elements.saveList.value = "Uncategorized";
    elements.saveFavorite.checked = existing
      ? isFavoriteEntry(existing)
      : true;
    elements.deleteDialogButton.classList.toggle("hidden", !existing);
    elements.saveNotes.value = existing?.notes || "";
    elements.saveWatched.checked = Boolean(existing?.watched);
    const next = sourceMetadata.next || null;
    elements.saveNextEnabled.checked = Boolean(next);
    elements.saveNextProvider.value = next?.baseUrl || target.baseUrl;
    if (!elements.saveNextProvider.value) {
      elements.saveNextProvider.value = "https://vidcore.net";
    }
    elements.saveNextMode.value = next?.mode || target.mode;
    elements.saveNextTitle.value = next?.title || "";
    elements.saveNextId.value = next?.id ||
      (target.mode === "tv" ? target.id : "");
    elements.saveNextSeason.value = next?.season ?? target.season ?? 1;
    elements.saveNextEpisode.value = next?.episode ??
      (target.mode === "tv" ? (target.episode ?? 1) + 1 : 1);
    elements.saveNewListName.value = "";
    syncNextFields();
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
    const destinationList = elements.saveList.value || "Uncategorized";
    const manualTitle = elements.saveTitle.value.trim();
    const next = nextEntryFromDialog();

    await VidCoreStorage.put(
      VidCoreStorage.STORES.favorites,
      {
        ...existing,
        ...entry,
        ...(metadata || {}),
        key,
        title:
          manualTitle ||
          metadata?.title ||
          existing?.title ||
          VidCoreMetadata.fallbackTitle(entry),
        next,
        list: destinationList,
        favorite: elements.saveFavorite.checked,
        notes: elements.saveNotes.value.trim(),
        watched: elements.saveWatched.checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      }
    );

    state.localArtworkCache.clear();

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
    state.selectedList = destinationList;
    showPanel("library");
    await renderAllLibraryViews();
    setStatus("Library updated", `Saved to ${destinationList}.`, "ok");
  }

  async function deleteFavorite(entry) {
    const key = entry.key || VidCoreMetadata.entryKey(entry);
    await VidCoreStorage.remove(
      VidCoreStorage.STORES.favorites,
      key
    );
    state.localArtworkCache.clear();
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

  async function createList(name) {
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

  async function deleteSelectedList() {
    const name = state.selectedList;
    if (!name || name === "All" || name === "Favorites") {
      setStatus("Choose a custom list", "All and Favorites cannot be deleted.", "warn");
      return;
    }

    const favorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    const members = favorites.filter(entry => categoryForEntry(entry) === name);
    const moveNote = members.length
      ? ` ${members.length} saved title${members.length === 1 ? "" : "s"} will move to Favorites.`
      : "";
    if (!globalThis.confirm(`Delete list “${name}”?${moveNote}`)) return;

    const updatedAt = new Date().toISOString();
    for (const entry of members) {
      await VidCoreStorage.put(
        VidCoreStorage.STORES.favorites,
        { ...entry, list: "Uncategorized", favorite: true, updatedAt }
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

  async function playListNeighbor(direction) {
    if (!state.storageReady) {
      setStatus("Library not ready", "Wait for storage to finish starting.", "warn");
      return;
    }
    if (state.scanner?.scanning) state.scanner.cancel();

    const entries = filterLibraryEntries(
      await VidCoreStorage.getAll(VidCoreStorage.STORES.favorites)
    );
    if (entries.length === 0) {
      setStatus("Active list is empty", "Choose a populated Library list.", "warn");
      return;
    }

    let currentKey = "";
    try {
      currentKey = VidCoreMetadata.entryKey(currentEntry());
    } catch {
    }
    const currentIndex = entries.findIndex(entry =>
      (entry.key || VidCoreMetadata.entryKey(entry)) === currentKey
    );
    const targetIndex = currentIndex < 0
      ? direction > 0 ? 0 : entries.length - 1
      : (currentIndex + direction + entries.length) % entries.length;
    const target = entries[targetIndex];

    await play(
      target,
      target.resolutionStatus === "resolved" ? target : null
    );
    setStatus(
      direction > 0 ? "Next in active list" : "Previous in active list",
      `${target.title || VidCoreMetadata.fallbackTitle(target)} · ${state.selectedList}`,
      "ok"
    );
  }

  async function selectedFavorites() {
    const entries = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );

    return state.selectedList === "All"
      ? entries
      : state.selectedList === "Favorites"
        ? entries.filter(isFavoriteEntry)
        : entries.filter(entry => categoryForEntry(entry) === state.selectedList);
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
          randomMode: elements.randomMode.value,
          volume: Number(elements.volumeSlider.value)
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
        if (payload.settings.volume !== undefined) {
          elements.volumeSlider.value = String(payload.settings.volume);
        }
        syncModeFields();
        applyVolume(false);
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
    elements.randomButton.textContent = scanning ? "Stop scan" : "Random";
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

  function applyVolume(announce = false) {
    const percent = Math.max(
      0,
      Math.min(100, Number(elements.volumeSlider.value) || 0)
    );
    state.volume = percent;
    elements.volumeSlider.value = String(percent);
    elements.volumeOutput.textContent = `${percent}%`;
    localStorage.setItem(`${SETTINGS_PREFIX}volume`, String(percent));
    VidCoreProviders.requestVolume(percent);
    postHost(`volume|${(percent / 100).toFixed(2)}`);
    if (announce) {
      setStatus(
        "Volume requested",
        globalThis.chrome?.webview
          ? `Native WebView audio set to ${percent}%.`
          : `Provider volume set to ${percent}% when supported.`,
        "ok"
      );
    }
  }

  function requestMute() {
    const muted = !state.muted;
    VidCoreProviders.requestMute(muted);
    if (globalThis.chrome?.webview) {
      postHost(`mute|${muted ? 1 : 0}`);
    } else {
      state.muted = muted;
      elements.muteButton.textContent = muted ? "Unmute" : "Mute";
    }
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

    if (command === "volume") {
      const percent = Math.round((Number(payload) || 0) * 100);
      state.volume = Math.max(0, Math.min(100, percent));
      elements.volumeSlider.value = String(state.volume);
      elements.volumeOutput.textContent = `${state.volume}%`;
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

    if (command === "extension") {
      const separator = payload.indexOf("|");
      const status = separator < 0 ? payload : payload.slice(0, separator);
      const detail = separator < 0 ? "" : payload.slice(separator + 1);
      const messages = {
        active: detail ? `${detail} is active.` : "The browser extension is active.",
        missing: "No unpacked extension found at data/extensions/ublock/manifest.json.",
        unsupported: "This WebView2 Runtime does not support browser extensions.",
        error: "The unpacked browser extension could not be loaded."
      };
      elements.extensionStatus.textContent =
        messages[status] || "Browser extension status is unknown.";
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
                list: raw.list && raw.list !== "Favorites"
                  ? raw.list
                  : "Uncategorized",
                favorite: Boolean(raw.favorite || raw.list === "Favorites"),
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


  async function migrateFavoriteOverlay() {
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
      const favoriteOverlayMigration = await migrateFavoriteOverlay();
      const artworkCleanup = await sanitizeStoredArtwork();
      elements.storageMode.textContent =
        VidCoreStorage.mode === "indexeddb"
          ? "IndexedDB storage active"
          : "localStorage fallback active";

      await renderAllLibraryViews();
      const restoredCurrent = await hydrateCurrentFromLibrary(false);
      if (restoredCurrent?.resolutionStatus === "resolved") {
        loadRelated(currentEntrySafe(), restoredCurrent).catch(() => {});
      }
      await pruneNativeArtworkCache();
      const migrated = migration.favorites + migration.history + favoriteOverlayMigration;
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
    elements.baseUrl.addEventListener("change", () => {
      if (elements.baseUrl.value === "https://www.youtube.com") {
        elements.mode.value = "youtube";
      } else if (elements.mode.value === "youtube") {
        elements.mode.value = "movie";
      }
      syncModeFields();
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
      playListNeighbor(-1).catch(error =>
        setStatus("List navigation failed", error.message, "error")
      );
    });

    elements.nextButton.addEventListener("click", () => {
      playListNeighbor(1).catch(error =>
        setStatus("List navigation failed", error.message, "error")
      );
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
    elements.youtubeButton.addEventListener(
      "click",
      () => openExternal(elements.youtubeButton.dataset.url)
    );
    elements.seriesNextButton.addEventListener(
      "click",
      () => playSeriesNext().catch(error =>
        setStatus("Series navigation failed", error.message, "error")
      )
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
    elements.muteButton.addEventListener("click", requestMute);
    elements.volumeSlider.addEventListener("input", () => applyVolume(false));
    elements.volumeSlider.addEventListener("change", () => applyVolume(true));
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
    elements.saveNextEnabled.addEventListener("change", syncNextFields);
    elements.saveNextMode.addEventListener("change", syncNextFields);
    elements.saveNextProvider.addEventListener("change", () => {
      if (elements.saveNextProvider.value === "https://www.youtube.com") {
        elements.saveNextMode.value = "youtube";
      } else if (elements.saveNextMode.value === "youtube") {
        elements.saveNextMode.value = "movie";
      }
      syncNextFields();
    });
    elements.saveAddListButton.addEventListener("click", () => {
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
    elements.resolveListButton.addEventListener(
      "click",
      resolveSelectedList
    );
    elements.markListWatchedButton.addEventListener(
      "click",
      markSelectedListWatched
    );
    elements.deleteListButton.addEventListener(
      "click",
      deleteSelectedList
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
        if (event.shiftKey) state.scanner.scanNeighbor(-1);
        else playListNeighbor(-1).catch(() => {});
      } else if (event.key === "]") {
        if (event.shiftKey) state.scanner.scanNeighbor(1);
        else playListNeighbor(1).catch(() => {});
      } else if (event.key.toLowerCase() === "r") {
        state.scanner.random(elements.randomMode.value);
      } else if (event.key.toLowerCase() === "t") {
        toggleTheater();
      } else if (event.key.toLowerCase() === "m") {
        requestMute();
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
    applyVolume(false);
    await initializeStorage();
  }

  start().catch(error =>
    setStatus("Application startup failed", error.message, "error")
  );
})();
