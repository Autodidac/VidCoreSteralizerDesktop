"use strict";

(() => {
  const DB_NAME = "vidcore-native-library";
  const DB_VERSION = 1;
  const STORES = Object.freeze({
    favorites: "favorites",
    lists: "lists",
    history: "history"
  });
  const STORE_NAMES = Object.values(STORES);
  const FALLBACK_PREFIX = "vidcoreNative.fallback.";

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(
        request.error ?? new Error("IndexedDB request failed.")
      );
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error ?? new Error("IndexedDB transaction failed.")
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error("IndexedDB transaction aborted.")
      );
    });
  }

  class IndexedDbBackend {
    constructor(database) {
      this.database = database;
    }

    transaction(storeName, mode) {
      if (!this.database) {
        throw new Error("IndexedDB connection is closed.");
      }
      return this.database.transaction(storeName, mode);
    }

    async getAll(storeName) {
      const transaction = this.transaction(storeName, "readonly");
      const values = await requestPromise(
        transaction.objectStore(storeName).getAll()
      );
      await transactionPromise(transaction);
      return values;
    }

    async get(storeName, key) {
      const transaction = this.transaction(storeName, "readonly");
      const value = await requestPromise(
        transaction.objectStore(storeName).get(key)
      );
      await transactionPromise(transaction);
      return value;
    }

    async put(storeName, value) {
      const transaction = this.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value);
      await transactionPromise(transaction);
    }

    async delete(storeName, key) {
      const transaction = this.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(key);
      await transactionPromise(transaction);
    }

    async clear(storeName) {
      const transaction = this.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).clear();
      await transactionPromise(transaction);
    }

    close() {
      this.database?.close();
      this.database = null;
    }
  }

  class LocalStorageBackend {
    constructor(prefix) {
      this.prefix = prefix;
      for (const storeName of STORE_NAMES) {
        const key = this.storeKey(storeName);
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, "{}");
        }
      }
    }

    storeKey(storeName) {
      return `${this.prefix}${storeName}`;
    }

    readStore(storeName) {
      try {
        const parsed = JSON.parse(
          localStorage.getItem(this.storeKey(storeName)) ?? "{}"
        );
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        return {};
      }
    }

    writeStore(storeName, value) {
      localStorage.setItem(this.storeKey(storeName), JSON.stringify(value));
    }

    async getAll(storeName) {
      return Object.values(this.readStore(storeName));
    }

    async get(storeName, key) {
      return this.readStore(storeName)[String(key)];
    }

    async put(storeName, value) {
      const keyName = storeName === STORES.lists ? "name" : "key";
      const key = value?.[keyName];
      if (key === undefined || key === null || key === "") {
        throw new Error(`Cannot save ${storeName}: missing ${keyName}.`);
      }

      const store = this.readStore(storeName);
      store[String(key)] = value;
      this.writeStore(storeName, store);
    }

    async delete(storeName, key) {
      const store = this.readStore(storeName);
      delete store[String(key)];
      this.writeStore(storeName, store);
    }

    async clear(storeName) {
      this.writeStore(storeName, {});
    }

    close() {}
  }

  async function openIndexedDb(timeoutMilliseconds = 6500) {
    if (!globalThis.indexedDB) {
      throw new Error("IndexedDB is unavailable.");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("IndexedDB startup timed out."));
      }, timeoutMilliseconds);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORES.favorites)) {
          const favorites = database.createObjectStore(
            STORES.favorites,
            { keyPath: "key" }
          );
          favorites.createIndex("list", "list", { unique: false });
          favorites.createIndex("title", "title", { unique: false });
        }

        if (!database.objectStoreNames.contains(STORES.lists)) {
          database.createObjectStore(
            STORES.lists,
            { keyPath: "name" }
          );
        }

        if (!database.objectStoreNames.contains(STORES.history)) {
          const history = database.createObjectStore(
            STORES.history,
            { keyPath: "key" }
          );
          history.createIndex(
            "lastPlayedAt",
            "lastPlayedAt",
            { unique: false }
          );
        }
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(request.error ?? new Error("IndexedDB failed to open."));
      };

      request.onblocked = () => {
        // The timeout handles a second stale instance without deadlocking startup.
      };

      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }

        settled = true;
        clearTimeout(timeout);
        resolve(database);
      };
    });
  }

  const state = {
    backend: null,
    mode: "pending",
    ready: null
  };

  async function initialize() {
    if (state.ready) {
      return state.ready;
    }

    state.ready = (async () => {
      try {
        const database = await openIndexedDb();
        const backend = new IndexedDbBackend(database);
        database.onversionchange = () => {
          backend.close();
          if (state.backend === backend) {
            state.backend = null;
            state.mode = "closed";
          }
        };
        state.backend = backend;
        state.mode = "indexeddb";
      } catch {
        state.backend = new LocalStorageBackend(FALLBACK_PREFIX);
        state.mode = "localstorage";
      }

      const favoriteList = await state.backend.get(
        STORES.lists,
        "Favorites"
      );

      if (!favoriteList) {
        await state.backend.put(STORES.lists, {
          name: "Favorites",
          createdAt: new Date().toISOString()
        });
      }

      return state.backend;
    })();

    return state.ready;
  }

  async function backend() {
    await initialize();
    if (!state.backend) {
      throw new Error("Library storage is unavailable.");
    }
    return state.backend;
  }

  async function getAll(storeName) {
    return (await backend()).getAll(storeName);
  }

  async function get(storeName, key) {
    return (await backend()).get(storeName, key);
  }

  async function put(storeName, value) {
    return (await backend()).put(storeName, value);
  }

  async function remove(storeName, key) {
    return (await backend()).delete(storeName, key);
  }

  async function clear(storeName) {
    return (await backend()).clear(storeName);
  }

  const BUILTIN_PROVIDERS = Object.freeze([
    Object.freeze({ id: "vidcore", label: "VidCore", baseUrl: "https://vidcore.net" }),
    Object.freeze({ id: "ythd", label: "YTHD", baseUrl: "https://ythd.org/embed" }),
    Object.freeze({ id: "vidup", label: "VidUp", baseUrl: "https://vidup.to" })
  ]);

  function normalizeProviderUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    } catch {
      return BUILTIN_PROVIDERS[0].baseUrl;
    }
  }

  function providerCatalog(entries) {
    const catalog = BUILTIN_PROVIDERS.map(provider => ({ ...provider }));
    const known = new Set(catalog.map(provider => provider.baseUrl));

    for (const entry of entries) {
      const baseUrl = normalizeProviderUrl(entry?.baseUrl);
      if (!known.has(baseUrl)) {
        known.add(baseUrl);
        catalog.push({
          id: `custom-${catalog.length}`,
          label: new URL(baseUrl).hostname,
          baseUrl
        });
      }
    }

    return catalog;
  }

  function compactEntry(entry, providers) {
    const baseUrl = normalizeProviderUrl(entry?.baseUrl);
    const provider = Math.max(
      0,
      providers.findIndex(candidate => candidate.baseUrl === baseUrl)
    );
    const {
      baseUrl: ignoredBaseUrl,
      key: ignoredKey,
      provider: ignoredProvider,
      ...rest
    } = entry;
    return provider === 0 ? rest : { ...rest, provider };
  }

  function recordKey(entry) {
    const baseUrl = normalizeProviderUrl(entry.baseUrl);
    return entry.mode === "tv"
      ? `${baseUrl}|tv|${entry.id}|${entry.season ?? 1}|${entry.episode ?? 1}`
      : `${baseUrl}|movie|${entry.id}`;
  }

  function expandEntry(entry, providers) {
    if (!entry || typeof entry !== "object") return null;

    let baseUrl = entry.baseUrl;
    if (!baseUrl) {
      const reference = Number.isInteger(entry.provider)
        ? entry.provider
        : Number.parseInt(entry.provider, 10);
      baseUrl = providers[Number.isInteger(reference) ? reference : 0]?.baseUrl;
    }

    const expanded = {
      ...entry,
      baseUrl: normalizeProviderUrl(baseUrl)
    };
    delete expanded.provider;
    expanded.key = recordKey(expanded);
    return expanded;
  }

  function readProviderCatalog(payload) {
    const source = Array.isArray(payload?.providers)
      ? payload.providers
      : Array.isArray(payload?.servers)
        ? payload.servers
        : [];

    const catalog = source
      .map((provider, index) => {
        const value = typeof provider === "string"
          ? provider
          : provider?.baseUrl || provider?.url;
        if (!value) return null;
        const baseUrl = normalizeProviderUrl(value);
        return {
          id: provider?.id || `provider-${index}`,
          label: provider?.label || new URL(baseUrl).hostname,
          baseUrl
        };
      })
      .filter(Boolean);

    return catalog.length
      ? catalog
      : BUILTIN_PROVIDERS.map(provider => ({ ...provider }));
  }

  async function exportData(extra = {}) {
    const [favorites, lists, history] = await Promise.all([
      getAll(STORES.favorites),
      getAll(STORES.lists),
      getAll(STORES.history)
    ]);
    const providers = providerCatalog([...favorites, ...history]);

    return {
      format: "vidcore-native-library",
      version: 2,
      exportedAt: new Date().toISOString(),
      providers,
      favorites: favorites.map(entry => compactEntry(entry, providers)),
      lists,
      history: history.map(entry => compactEntry(entry, providers)),
      ...extra
    };
  }

  async function importData(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Backup is not a JSON object.");
    }

    const providers = readProviderCatalog(payload);
    const rawFavorites = Array.isArray(payload.favorites) ? payload.favorites : [];
    const lists = Array.isArray(payload.lists) ? payload.lists : [];
    const rawHistory = Array.isArray(payload.history) ? payload.history : [];
    const favorites = rawFavorites
      .map(entry => expandEntry(entry, providers))
      .filter(Boolean);
    const history = rawHistory
      .map(entry => expandEntry(entry, providers))
      .filter(Boolean);
    const target = await backend();

    for (const list of lists) {
      if (list?.name) await target.put(STORES.lists, list);
    }

    if (!await target.get(STORES.lists, "Favorites")) {
      await target.put(STORES.lists, {
        name: "Favorites",
        createdAt: new Date().toISOString()
      });
    }

    for (const entry of favorites) {
      if (entry.key) await target.put(STORES.favorites, entry);
    }

    for (const entry of history) {
      if (entry.key) await target.put(STORES.history, entry);
    }

    return {
      favorites: favorites.length,
      lists: lists.length,
      history: history.length,
      importedVersion: Number(payload.version) || 1
    };
  }

  globalThis.VidCoreStorage = Object.freeze({
    STORES,
    initialize,
    get mode() {
      return state.mode;
    },
    getAll,
    get,
    put,
    remove,
    clear,
    exportData,
    importData
  });
})();
