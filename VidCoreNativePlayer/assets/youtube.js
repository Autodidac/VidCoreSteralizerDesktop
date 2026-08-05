"use strict";

(() => {
  const YT = "https://www.youtube.com";
  const STOREFRONT = "https://www.youtube.com/feed/storefront?bp=ogUCKAY";
  const API = "https://www.googleapis.com/youtube/v3";
  const KEY_STORAGE = "vidcoreNative.youtubeDataApiKey";
  const $ = value => document.querySelector(value);
  const el = {
    panel: $("#youtubePanel"),
    tab: $('.tab[data-panel="youtube"]'),
    storefront: $("#youtubeStorefrontButton"),
    shuffle: $("#youtubeShuffleButton"),
    search: $("#youtubeSearch"),
    chips: $("#youtubeListChips"),
    quick: $("#youtubeQuickAdd"),
    quickButton: $("#youtubeQuickAddButton"),
    saved: $("#youtubeSavedCards"),
    random: $("#youtubeRandomCards"),
    related: $("#youtubeRelatedCards"),
    key: $("#youtubeApiKey"),
    saveKey: $("#youtubeSaveApiKeyButton"),
    forgetKey: $("#youtubeForgetApiKeyButton"),
    reference: $("#youtubeChannelReference"),
    label: $("#youtubeChannelLabel"),
    addChannel: $("#youtubeAddChannelButton"),
    checkAll: $("#youtubeCheckChannelsButton"),
    status: $("#youtubeChannelStatus"),
    channels: $("#youtubeChannelCards"),
    channelVideos: $("#youtubeChannelVideoCards"),
    base: $("#baseUrl"),
    mode: $("#mode"),
    id: $("#mediaId"),
    play: $("#playButton"),
    save: $("#favoriteButton"),
    dialog: $("#saveDialog")
  };
  if (!el.panel || !globalThis.VidCoreStorage || !globalThis.VidCoreMetadata) return;

  const state = {
    list: "All YouTube",
    random: [],
    latest: [],
    checking: false
  };

  function makeButton(label, action, extra = "") {
    const result = document.createElement("button");
    result.type = "button";
    result.className = `button ${extra}`.trim();
    result.textContent = label;
    result.addEventListener("click", action);
    return result;
  }

  function empty(message) {
    const result = document.createElement("div");
    result.className = "empty-card";
    result.textContent = message;
    return result;
  }

  function status(message, type = "") {
    el.status.textContent = message;
    el.status.dataset.type = type;
  }

  function external(url) {
    if (globalThis.chrome?.webview) {
      globalThis.chrome.webview.postMessage(`open-external|${url}`);
    } else {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function entry(value, extra = {}) {
    return {
      ...extra,
      ...VidCoreMetadata.normalizeEntry({
        baseUrl: YT,
        mode: "youtube",
        id: value
      })
    };
  }

  function select(item) {
    el.base.value = YT;
    el.mode.value = "youtube";
    el.id.value = item.id;
    for (const input of [el.base, el.mode, el.id]) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function openSave(item) {
    select(item);
    el.save.click();
  }

  function card(item, saved = false, source = "") {
    const result = document.createElement("article");
    result.className = "media-card youtube-video-card";
    const poster = document.createElement("div");
    poster.className = "card-poster";
    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      poster.append(image);
    } else {
      poster.textContent = "YT";
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.title || VidCoreMetadata.fallbackTitle(item);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    for (const value of [
      item.author || item.channelTitle,
      item.year,
      item.list,
      source
    ].filter(Boolean)) {
      const span = document.createElement("span");
      span.textContent = value;
      meta.append(span);
    }
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Play", () => {
        select(item);
        el.play.click();
      }, "primary"),
      makeButton(saved ? "Edit" : "Save", () => openSave(item)),
      makeButton("YouTube", () =>
        external(`${YT}/watch?v=${encodeURIComponent(item.id)}`))
    );
    body.append(title, meta, actions);
    result.append(poster, body);
    return result;
  }

  function category(item) {
    const value = String(item.list || "").trim();
    return value && value !== "Favorites" ? value : "Uncategorized";
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  async function savedEntries() {
    return (await VidCoreStorage.getAll(VidCoreStorage.STORES.favorites))
      .filter(item => item.mode === "youtube")
      .sort((left, right) => String(right.updatedAt || right.createdAt || "")
        .localeCompare(String(left.updatedAt || left.createdAt || "")));
  }

  function renderCards(target, items, options = {}) {
    target.replaceChildren();
    if (!items.length) {
      target.append(empty(options.empty || "Nothing to show yet."));
      return;
    }
    for (const item of items) {
      target.append(card(item, Boolean(options.saved), options.source || ""));
    }
  }

  function related(items) {
    const currentId = el.mode.value === "youtube"
      ? String(VidCoreMetadata.normalizeMediaId("youtube", el.id.value))
      : "";
    const current = items.find(item => item.id === currentId) || items[0];
    if (!current) return [];
    const words = value => new Set(String(value.title || "").toLowerCase()
      .split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2));
    const currentWords = words(current);
    return items.filter(item => item.id !== current.id).map(item => {
      let score = category(item) === category(current) ? 16 : 0;
      if (current.channelId && item.channelId === current.channelId) score += 50;
      if (current.author && item.author === current.author) score += 35;
      for (const word of words(item)) if (currentWords.has(word)) score += 4;
      return { item, score };
    }).sort((a, b) => b.score - a.score).slice(0, 8).map(value => value.item);
  }


  function reference(value) {
    const raw = String(value || "").trim();
    if (!raw) throw new Error("Enter an @handle, channel URL, or channel ID.");
    let candidate = raw;
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `${YT}/${raw}`);
      if (url.hostname !== "youtube.com" && !url.hostname.endsWith(".youtube.com")) {
        throw new Error("Use a youtube.com channel URL.");
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "channel" && parts[1]) candidate = parts[1];
      else if (parts[0]?.startsWith("@")) candidate = parts[0];
      else if (parts[0] === "user" && parts[1]) {
        return {
          key: `username:${parts[1].toLowerCase()}`,
          kind: "username",
          value: parts[1],
          url: `${YT}/user/${encodeURIComponent(parts[1])}`
        };
      } else if (/^https?:\/\//i.test(raw)) {
        throw new Error("Use an @handle or a /channel/UC… URL.");
      }
    } catch (error) {
      if (/^https?:\/\//i.test(raw)) throw error;
    }
    if (/^UC[A-Za-z0-9_-]{20,30}$/.test(candidate)) {
      return {
        key: candidate,
        kind: "id",
        value: candidate,
        url: `${YT}/channel/${candidate}`
      };
    }
    if (candidate.startsWith("@") && candidate.length > 1) {
      const handle = candidate.slice(1);
      return {
        key: `handle:@${handle.toLowerCase()}`,
        kind: "handle",
        value: handle,
        url: `${YT}/@${encodeURIComponent(handle)}`
      };
    }
    throw new Error("Use an @handle, channel URL, legacy /user/ URL, or channel ID.");
  }

  function apiKey() {
    return String(localStorage.getItem(KEY_STORAGE) || "").trim();
  }

  async function api(path, parameters) {
    if (!apiKey()) {
      throw new Error("Save a YouTube Data API key before checking updates.");
    }
    const url = new URL(`${API}/${path}`);
    for (const [name, value] of Object.entries({
      ...parameters,
      key: apiKey()
    })) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(name, String(value));
      }
    }
    const response = await fetch(url.href, { referrerPolicy: "no-referrer" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message ||
        `YouTube API request failed (${response.status}).`);
    }
    return payload;
  }

  async function resolveChannel(channel) {
    const ref = channel.kind
      ? channel
      : reference(channel.reference || channel.url || channel.id);
    const filter = ref.kind === "id"
      ? { id: ref.value }
      : ref.kind === "username"
        ? { forUsername: ref.value }
        : { forHandle: ref.value };
    const payload = await api("channels", {
      part: "snippet,contentDetails",
      ...filter,
      maxResults: 1
    });
    const item = payload.items?.[0];
    if (!item) throw new Error("YouTube did not return a matching channel.");
    return {
      ...channel,
      key: channel.key || ref.key,
      kind: ref.kind,
      reference: channel.reference || ref.value,
      id: item.id,
      url: `${YT}/channel/${item.id}`,
      title: item.snippet?.title || channel.title || ref.value,
      description: item.snippet?.description || "",
      image: item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url || "",
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || "",
      updatedAt: new Date().toISOString()
    };
  }

  async function channelUpdates(channel) {
    const resolved = await resolveChannel(channel);
    if (!resolved.uploadsPlaylistId) {
      throw new Error(`${resolved.title} has no uploads playlist.`);
    }
    const payload = await api("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: resolved.uploadsPlaylistId,
      maxResults: 12
    });
    const videos = (payload.items || []).map(item => {
      const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (!id) return null;
      const publishedAt = item.contentDetails?.videoPublishedAt ||
        item.snippet?.publishedAt || "";
      return entry(id, {
        title: item.snippet?.title || `YouTube ${id}`,
        description: item.snippet?.description || "",
        image: item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url || "",
        author: item.snippet?.channelTitle || resolved.title,
        channelId: item.snippet?.videoOwnerChannelId || resolved.id,
        channelUrl: resolved.url,
        publishedAt,
        year: publishedAt ? String(new Date(publishedAt).getUTCFullYear()) : "",
        list: "YouTube",
        resolutionStatus: "resolved"
      });
    }).filter(Boolean);
    const updated = {
      ...resolved,
      lastCheckedAt: new Date().toISOString(),
      latestVideoAt: videos[0]?.publishedAt || resolved.latestVideoAt || ""
    };
    await VidCoreStorage.put(VidCoreStorage.STORES.youtubeChannels, updated);
    return { updated, videos };
  }

  function mergeLatest(items) {
    const merged = new Map([...state.latest, ...items].map(item => [item.id, item]));
    state.latest = [...merged.values()]
      .sort((a, b) => String(b.publishedAt || "")
        .localeCompare(String(a.publishedAt || "")))
      .slice(0, 40);
  }

  function channelCard(channel) {
    const result = document.createElement("article");
    result.className = "channel-card";
    const avatar = document.createElement("div");
    avatar.className = "channel-avatar";
    if (channel.image) {
      const image = document.createElement("img");
      image.src = channel.image;
      image.alt = "";
      image.loading = "lazy";
      avatar.append(image);
    } else {
      avatar.textContent = "YT";
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = channel.title || channel.reference || channel.id;
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const checked = document.createElement("span");
    checked.textContent = channel.lastCheckedAt
      ? `Checked ${new Date(channel.lastCheckedAt).toLocaleString()}`
      : "Not checked yet";
    meta.append(checked);
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      makeButton("Check updates", async () => {
        try {
          status(`Checking ${title.textContent}…`);
          const resultValue = await channelUpdates(channel);
          mergeLatest(resultValue.videos);
          await render();
          status(`Loaded ${resultValue.videos.length} recent uploads.`, "ok");
        } catch (error) {
          status(error.message, "error");
        }
      }, "primary"),
      makeButton("Open", () => external(channel.url)),
      makeButton("Unfollow", async () => {
        await VidCoreStorage.remove(
          VidCoreStorage.STORES.youtubeChannels,
          channel.key
        );
        await render();
        status("Channel removed from the local watchlist.", "ok");
      }, "danger")
    );
    body.append(title, meta, actions);
    result.append(avatar, body);
    return result;
  }


  async function renderChannels() {
    const channels = (await VidCoreStorage.getAll(
      VidCoreStorage.STORES.youtubeChannels
    )).sort((a, b) => String(a.title || a.reference || "")
      .localeCompare(String(b.title || b.reference || "")));
    el.channels.replaceChildren();
    if (!channels.length) {
      el.channels.append(empty(
        "Follow channels locally, then check their official uploads feed."
      ));
    } else {
      for (const channel of channels) el.channels.append(channelCard(channel));
    }
    renderCards(el.channelVideos, state.latest, {
      empty: "Check followed channels to see their latest uploads.",
      source: "Channel update"
    });
  }

  async function render() {
    await VidCoreStorage.initialize();
    const items = await savedEntries();
    const categories = [...new Set(items.map(category))]
      .sort((a, b) => a.localeCompare(b));
    const lists = ["All YouTube", ...categories];
    if (!lists.includes(state.list)) state.list = lists[0];
    el.chips.replaceChildren();
    for (const name of lists) {
      const count = name === "All YouTube"
        ? items.length
        : items.filter(item => category(item) === name).length;
      const chip = makeButton(`${name} ${count}`, async () => {
        state.list = name;
        await render();
      });
      chip.className = "list-chip";
      chip.classList.toggle("active", name === state.list);
      el.chips.append(chip);
    }

    const query = el.search.value.trim().toLowerCase();
    const filtered = items.filter(item =>
      (state.list === "All YouTube" || category(item) === state.list) &&
      (!query || [
        item.title,
        item.id,
        item.author,
        item.notes,
        category(item)
      ].filter(Boolean).some(value =>
        String(value).toLowerCase().includes(query)
      ))
    );

    const ids = new Set(items.map(item => item.id));
    state.random = state.random.filter(item => ids.has(item.id));
    if (!state.random.length && items.length) {
      state.random = shuffle(items).slice(0, 6);
    }
    renderCards(el.saved, filtered, {
      saved: true,
      empty: "Save a YouTube video to start your YouTube lists."
    });
    renderCards(el.random, state.random, {
      saved: true,
      source: "Random pick",
      empty: "Random picks appear after you save YouTube videos."
    });
    renderCards(el.related, related(items), {
      saved: true,
      source: "Local related",
      empty: "Related choices use shared channels, lists, and title words."
    });
    await renderChannels();
  }

  async function addVideo() {
    const item = entry(el.quick.value);
    el.quick.value = "";
    openSave(item);
  }

  async function follow() {
    const ref = reference(el.reference.value);
    const existing = await VidCoreStorage.get(
      VidCoreStorage.STORES.youtubeChannels,
      ref.key
    );
    let channel = {
      ...existing,
      ...ref,
      reference: ref.value,
      title: el.label.value.trim() || existing?.title ||
        (ref.kind === "handle" ? `@${ref.value}` : ref.value),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (apiKey()) channel = await resolveChannel(channel);
    await VidCoreStorage.put(VidCoreStorage.STORES.youtubeChannels, channel);
    el.reference.value = "";
    el.label.value = "";
    await render();
    status(
      apiKey()
        ? `Following ${channel.title}; ready to check uploads.`
        : `Following ${channel.title}. Add an API key to check uploads.`,
      "ok"
    );
  }

  async function checkAll() {
    if (state.checking) return;
    const channels = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.youtubeChannels
    );
    if (!channels.length) {
      status("Follow at least one channel first.", "error");
      return;
    }
    if (!apiKey()) {
      status("Save a YouTube Data API key before checking updates.", "error");
      return;
    }
    state.checking = true;
    el.checkAll.disabled = true;
    state.latest = [];
    let completed = 0;
    const failures = [];
    try {
      for (const channel of channels) {
        status(`Checking ${completed + 1} of ${channels.length}: ${channel.title || channel.reference}…`);
        try {
          const resultValue = await channelUpdates(channel);
          mergeLatest(resultValue.videos);
          completed += 1;
        } catch (error) {
          failures.push(`${channel.title || channel.reference}: ${error.message}`);
        }
      }
      await render();
      status(
        failures.length
          ? `Checked ${completed}; ${failures.length} failed. ${failures[0]}`
          : `Checked ${completed} channel(s); loaded ${state.latest.length} recent videos.`,
        failures.length ? "error" : "ok"
      );
    } finally {
      state.checking = false;
      el.checkAll.disabled = false;
    }
  }

  function report(action) {
    Promise.resolve().then(action).catch(error => status(error.message, "error"));
  }

  el.key.value = apiKey();
  el.storefront.addEventListener("click", () => external(STOREFRONT));
  el.shuffle.addEventListener("click", () => report(async () => {
    state.random = shuffle(await savedEntries()).slice(0, 6);
    await render();
  }));
  el.search.addEventListener("input", () => report(render));
  el.quickButton.addEventListener("click", () => report(addVideo));
  el.quick.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      report(addVideo);
    }
  });
  el.saveKey.addEventListener("click", () => {
    const value = el.key.value.trim();
    if (!value) {
      status("Enter an API key before saving.", "error");
      return;
    }
    localStorage.setItem(KEY_STORAGE, value);
    status("API key saved only on this device.", "ok");
  });
  el.forgetKey.addEventListener("click", () => {
    localStorage.removeItem(KEY_STORAGE);
    el.key.value = "";
    status("Local API key forgotten.", "ok");
  });
  el.addChannel.addEventListener("click", () => report(follow));
  el.reference.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      report(follow);
    }
  });
  el.checkAll.addEventListener("click", () => report(checkAll));
  el.tab.addEventListener("click", () => report(render));
  el.dialog?.addEventListener("close", () => report(render));

  report(render);
})();
