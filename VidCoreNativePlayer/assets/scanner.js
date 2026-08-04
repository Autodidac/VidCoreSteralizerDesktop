"use strict";

(() => {
  const QUEUE_KEY = "vidcoreLibrary.discoveryQueue";
  const QUEUE_LIMIT = 40;
  const CANDIDATE_DELAY_MS = 750;
  const RANDOM_MAX_ID = 2_000_000;
  const MIN_RELEASE_YEAR = 1910;

  function queueKey(entry) {
    return [
      entry.mode,
      entry.id,
      entry.season || "",
      entry.episode || ""
    ].join("|");
  }

  function readQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(entry =>
            entry?.image &&
            !VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)
          )
        : [];
    } catch {
      return [];
    }
  }

  function writeQueue(entries) {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(entries.slice(0, QUEUE_LIMIT))
    );
  }

  function addResolvedImage(entry) {
    if (!entry?.id || !entry?.image || VidCoreMetadata.isLikelyBadArtwork(entry, entry, entry.image)) {
      return readQueue();
    }

    const normalized = {
      ...entry,
      discoveredAt: new Date().toISOString()
    };

    const key = queueKey(normalized);
    const queue = readQueue().filter(item => queueKey(item) !== key);
    queue.unshift(normalized);
    writeQueue(queue);
    return queue;
  }

  function idProperty(mode) {
    return mode === "movie"
      ? { property: "P4947", variable: "movieTmdb" }
      : { property: "P4983", variable: "tvTmdb" };
  }

  function neighborPickQuery(mode, boundaryId, direction) {
    const { property, variable } = idProperty(mode);
    const comparison = direction > 0 ? ">" : "<";
    const order = direction > 0 ? "ASC" : "DESC";

    return `SELECT ?${variable} ?numericId WHERE {
      ?item wdt:${property} ?${variable}.
      BIND(xsd:integer(?${variable}) AS ?numericId)
      FILTER(?numericId ${comparison} ${Number(boundaryId)})
    }
    ORDER BY ${order}(?numericId)
    LIMIT 1`;
  }

  function seedPickQuery(mode, seed) {
    const { property, variable } = idProperty(mode);

    return `SELECT ?${variable} ?numericId WHERE {
      ?item wdt:${property} ?${variable}.
      BIND(xsd:integer(?${variable}) AS ?numericId)
      FILTER(?numericId >= ${Number(seed)})
    }
    ORDER BY ASC(?numericId)
    LIMIT 1`;
  }

  function databaseTitlePickQuery(mode, year, month) {
    const { property, variable } = idProperty(mode);

    return `SELECT ?${variable} ?numericId WHERE {
      ?item wdt:${property} ?${variable};
            wdt:P577 ?date.
      BIND(xsd:integer(?${variable}) AS ?numericId)
      FILTER(
        YEAR(?date) = ${Number(year)} &&
        MONTH(?date) = ${Number(month)}
      )
    }
    ORDER BY ASC(?numericId)
    LIMIT 1`;
  }

  async function queryId(query, mode) {
    const data = await VidCoreMetadata.runSparql(query);
    const binding = data?.results?.bindings?.[0];
    return VidCoreMetadata.bindingValue(
      binding,
      mode === "movie" ? "movieTmdb" : "tvTmdb"
    );
  }

  function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  function create(options) {
    let activeScan = null;

    function setScanning(scanning) {
      options.onScanningChanged?.(scanning);
    }

    function cancel() {
      if (!activeScan) return false;
      activeScan.cancelled = true;
      activeScan = null;
      setScanning(false);
      options.status?.("Discovery stopped", "The active metadata scan was canceled.", "warn");
      return true;
    }

    function isResolvedMatch(entry, metadata) {
      return metadata?.resolutionStatus === "resolved" &&
        !VidCoreMetadata.isGenericTitle(entry, metadata?.title);
    }

    async function findResolved(entry) {
      const metadata = await options.resolve(entry, true);
      return isResolvedMatch(entry, metadata) ? metadata : null;
    }

    async function finish(token, entry, metadata, label) {
      if (token.cancelled) return;
      addResolvedImage({ ...entry, ...metadata });
      options.onDiscovered?.({ ...entry, ...metadata });
      activeScan = null;
      setScanning(false);
      options.status?.(
        label,
        `${metadata.title} at ID ${entry.id}.`,
        "ok"
      );
      await options.play(entry, metadata);
    }

    async function scanFromBoundary(
      direction,
      startingBoundary,
      label
    ) {
      const current = options.currentEntry();
      const token = { cancelled: false };
      activeScan = token;
      setScanning(true);
      let boundary = Number(startingBoundary);

      try {
        while (!token.cancelled) {
          if (boundary < 0) {
            throw new Error("No lower numeric IDs remain.");
          }

          options.status?.(
            "Scanning public metadata",
            `Finding the nearest resolved ${current.mode} ID ${direction > 0 ? "after" : "before"} ${boundary}…`
          );

          const id = await queryId(
            neighborPickQuery(current.mode, boundary, direction),
            current.mode
          );

          if (!id) {
            throw new Error("No further public metadata matches were found.");
          }

          const entry = {
            ...current,
            id
          };

          const metadata = await findResolved(entry);
          if (token.cancelled) return;

          if (metadata) {
            await finish(token, entry, metadata, label);
            return;
          }

          boundary = Number(id);
          await sleep(CANDIDATE_DELAY_MS);
        }
      } catch (error) {
        if (!token.cancelled) {
          options.status?.(
            "Discovery failed",
            error.message,
            "error"
          );
        }
      } finally {
        if (activeScan === token) {
          activeScan = null;
        }
        setScanning(false);
      }
    }

    async function scanNeighbor(direction) {
      if (cancel()) return;

      const current = options.currentEntry();
      if (!/^\d+$/.test(current.id)) {
        options.status?.(
          "Numeric TMDB ID required",
          "Sequential discovery cannot increment an IMDb tt… identifier.",
          "warn"
        );
        return;
      }

      await scanFromBoundary(
        direction,
        Number(current.id),
        direction > 0 ? "Next match" : "Previous match"
      );
    }

    async function randomNumberPick() {
      if (cancel()) return;

      const current = options.currentEntry();
      const token = { cancelled: false };
      activeScan = token;
      setScanning(true);

      try {
        const seed = 1 + Math.floor(Math.random() * RANDOM_MAX_ID);
        options.status?.(
          "Random ID discovery",
          `Finding a resolved ${current.mode} near ID ${seed}…`
        );

        let id = await queryId(
          seedPickQuery(current.mode, seed),
          current.mode
        );

        if (!id) {
          id = await queryId(
            seedPickQuery(current.mode, 1),
            current.mode
          );
        }

        if (!id) {
          throw new Error("No public metadata ID was returned.");
        }

        activeScan = null;
        setScanning(false);
        await scanFromBoundary(
          1,
          Number(id) - 1,
          "Random match"
        );
      } catch (error) {
        if (!token.cancelled) {
          options.status?.(
            "Random discovery failed",
            error.message,
            "error"
          );
        }
        if (activeScan === token) {
          activeScan = null;
        }
        setScanning(false);
      }
    }

    async function randomDatabasePick() {
      if (cancel()) return;

      const current = options.currentEntry();
      const token = { cancelled: false };
      activeScan = token;
      setScanning(true);

      try {
        const currentYear = new Date().getUTCFullYear();
        const year = MIN_RELEASE_YEAR +
          Math.floor(
            Math.random() * (currentYear - MIN_RELEASE_YEAR + 1)
          );
        const month = 1 + Math.floor(Math.random() * 12);

        options.status?.(
          "Database discovery",
          `Choosing a ${current.mode} released in ${year}-${String(month).padStart(2, "0")}…`
        );

        let id = await queryId(
          databaseTitlePickQuery(current.mode, year, month),
          current.mode
        );

        if (!id) {
          const seed = 1 + Math.floor(Math.random() * RANDOM_MAX_ID);
          id = await queryId(
            seedPickQuery(current.mode, seed),
            current.mode
          );
        }

        if (!id) {
          throw new Error("No usable public database ID was returned.");
        }

        const entry = {
          ...current,
          id
        };

        const metadata = await findResolved(entry);
        if (!metadata) {
          activeScan = null;
          setScanning(false);
          await scanFromBoundary(
            1,
            Number(id),
            "Database match"
          );
          return;
        }

        await finish(
          token,
          entry,
          metadata,
          "Database pick"
        );
      } catch (error) {
        if (!token.cancelled) {
          options.status?.(
            "Database discovery failed",
            error.message,
            "error"
          );
        }
      } finally {
        if (activeScan === token) {
          activeScan = null;
        }
        setScanning(false);
      }
    }

    async function random(mode) {
      if (mode === "database") {
        return randomDatabasePick();
      }
      return randomNumberPick();
    }

    return Object.freeze({
      cancel,
      scanNeighbor,
      random,
      addResolvedImage,
      readQueue,
      get scanning() {
        return activeScan !== null;
      }
    });
  }

  globalThis.VidCoreScanner = Object.freeze({
    create,
    addResolvedImage,
    readQueue,
    neighborPickQuery,
    seedPickQuery,
    databaseTitlePickQuery
  });
})();
