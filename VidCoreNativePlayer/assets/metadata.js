"use strict";

(() => {
  const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
  const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
  const WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php";
  const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
  const WIKIPEDIA_SEARCH_LIMIT = 8;
  const RELATED_REPAIR_LIMIT = 18;

  function normalizeBaseUrl(value) {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:") {
      throw new Error("Provider URL must use HTTPS.");
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  }

  function normalizeId(value) {
    const input = String(value || "").trim();
    const imdb = input.match(/tt\d{7,10}/i);
    if (imdb) {
      return imdb[0].toLowerCase();
    }

    if (/^\d+$/.test(input)) {
      return String(Number.parseInt(input, 10));
    }

    throw new Error("Use a numeric TMDB ID or IMDb tt… ID.");
  }

  function readInteger(value, label, minimum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < minimum) {
      throw new Error(`${label} must be ${minimum} or higher.`);
    }
    return parsed;
  }

  function normalizeEntry(entry) {
    const normalized = {
      baseUrl: normalizeBaseUrl(entry.baseUrl),
      mode: entry.mode === "tv" ? "tv" : "movie",
      id: normalizeId(entry.id)
    };

    if (normalized.mode === "tv") {
      normalized.season = readInteger(entry.season, "Season", 0);
      normalized.episode = readInteger(entry.episode, "Episode", 1);
    }

    return normalized;
  }

  function entryKey(entry) {
    return entry.mode === "movie"
      ? `${entry.baseUrl}|movie|${entry.id}`
      : `${entry.baseUrl}|tv|${entry.id}|${entry.season}|${entry.episode}`;
  }

  function fallbackTitle(entry) {
    return entry.mode === "movie"
      ? `Movie ${entry.id}`
      : `TV ${entry.id} · S${entry.season} E${entry.episode}`;
  }

  function buildPlayerUrl(entry, autoplay = true) {
    const normalized = normalizeEntry(entry);
    const path = normalized.mode === "movie"
      ? `/movie/${encodeURIComponent(normalized.id)}`
      : `/tv/${encodeURIComponent(normalized.id)}/${normalized.season}/${normalized.episode}`;
    const url = new URL(normalized.baseUrl + path);
    url.searchParams.set("autoPlay", autoplay ? "true" : "false");
    url.searchParams.set("title", "true");
    url.searchParams.set("poster", "true");
    url.searchParams.set("fullscreenButton", "true");
    return url.href;
  }

  function sparqlLiteral(value) {
    const escaped = String(value)
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"');
    return `"${escaped}"`;
  }

  function bindingValue(binding, key) {
    return binding?.[key]?.value || "";
  }

  function isGenericTitle(entry, title) {
    const normalized = String(title || "").trim();
    return !normalized ||
      normalized === fallbackTitle(entry) ||
      /^Q\d+$/i.test(normalized) ||
      /^(movie|tv)\s+\d+/i.test(normalized);
  }

  function needsRepair(entry) {
    return !entry?.image ||
      isLikelyBadArtwork(entry, entry, entry?.image) ||
      !entry?.description ||
      isGenericTitle(entry, entry?.title);
  }

  async function fetchJson(url, options = {}, timeoutMilliseconds = 18000) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMilliseconds
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status}).`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function runSparql(query) {
    const url = new URL(WIKIDATA_ENDPOINT);
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");

    return fetchJson(url, {
      headers: {
        Accept: "application/sparql-results+json"
      }
    });
  }

  function metadataQuery(entry) {
    const identifierPattern = /^tt\d+$/i.test(entry.id)
      ? `?item wdt:P345 ${sparqlLiteral(entry.id)}.`
      : entry.mode === "movie"
        ? `?item wdt:P4947 ${sparqlLiteral(entry.id)}.`
        : `?item wdt:P4983 ${sparqlLiteral(entry.id)}.`;

    return `SELECT ?item ?itemLabel ?itemDescription ?date ?poster ?logo ?image ?imdb ?movieTmdb ?tvTmdb ?article
      (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
      (GROUP_CONCAT(DISTINCT STR(?genre); separator="|") AS ?genreUris)
      WHERE {
        ${identifierPattern}
        OPTIONAL { ?item wdt:P577 ?date. }
        OPTIONAL { ?item wdt:P3383 ?poster. }
        OPTIONAL { ?item wdt:P154 ?logo. }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P345 ?imdb. }
        OPTIONAL { ?item wdt:P4947 ?movieTmdb. }
        OPTIONAL { ?item wdt:P4983 ?tvTmdb. }
        OPTIONAL {
          ?article schema:about ?item;
                   schema:isPartOf <https://en.wikipedia.org/>.
        }
        OPTIONAL {
          ?item wdt:P136 ?genre.
          ?genre rdfs:label ?genreLabel.
          FILTER(LANG(?genreLabel) = "en")
        }
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "en".
        }
      }
      GROUP BY ?item ?itemLabel ?itemDescription ?date ?poster ?logo ?image ?imdb
               ?movieTmdb ?tvTmdb ?article
      LIMIT 1`;
  }

  function metadataFromBinding(entry, binding) {
    if (!binding) {
      return {
        title: fallbackTitle(entry),
        description: "No matching Wikidata metadata was found.",
        year: "",
        image: "",
        imdb: /^tt\d+$/i.test(entry.id) ? entry.id : "",
        tmdb: /^\d+$/.test(entry.id) ? entry.id : "",
        genres: [],
        genreUris: [],
        wikidata: "",
        article: "",
        wikipedia: "",
        resolutionStatus: "not-found",
        resolvedAt: new Date().toISOString()
      };
    }

    return {
      title: bindingValue(binding, "itemLabel") || fallbackTitle(entry),
      description: bindingValue(binding, "itemDescription"),
      year: bindingValue(binding, "date").slice(0, 4),
      image: selectArtworkImage(entry, {
        title: bindingValue(binding, "itemLabel") || fallbackTitle(entry),
        year: bindingValue(binding, "date").slice(0, 4)
      }, [
        { kind: "poster", value: bindingValue(binding, "poster") },

        { kind: "logo", value: bindingValue(binding, "logo") },
        { kind: "image", value: bindingValue(binding, "image") }
      ]),
      imdb: bindingValue(binding, "imdb"),
      tmdb: entry.mode === "movie"
        ? bindingValue(binding, "movieTmdb")
        : bindingValue(binding, "tvTmdb"),
      genres: bindingValue(binding, "genres").split("|").filter(Boolean),
      genreUris: bindingValue(binding, "genreUris").split("|").filter(Boolean),
      wikidata: bindingValue(binding, "item"),
      article: bindingValue(binding, "article"),
      wikipedia: "",
      resolutionStatus: "resolved",
      resolvedAt: new Date().toISOString()
    };
  }

  function articleTitle(articleUrl) {
    if (!articleUrl) return "";

    try {
      const url = new URL(articleUrl);
      const marker = "/wiki/";
      const index = url.pathname.indexOf(marker);
      return index >= 0
        ? decodeURIComponent(url.pathname.slice(index + marker.length))
        : "";
    } catch {
      return "";
    }
  }

  function wikidataEntityId(value) {
    const match = String(value || "").match(/(?:entity\/)?(Q\d+)$/i);
    return match ? match[1].toUpperCase() : "";
  }

  function commonsImageUrl(fileName) {
    if (!fileName) return "";
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1000`;
  }

  async function fetchWikidataEntity(metadata) {
    const entityId = wikidataEntityId(metadata.wikidata);
    if (!entityId) return null;

    const url = new URL(WIKIDATA_API);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", entityId);
    url.searchParams.set("props", "claims|sitelinks|labels|descriptions");
    url.searchParams.set("languages", "en");
    url.searchParams.set("sitefilter", "enwiki");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const payload = await fetchJson(url);
    return payload?.entities?.[entityId] || null;
  }

  function mergeWikidataEntity(entry, metadata, entity) {
    if (!entity || entity.missing !== undefined) return metadata;

    const posterName = entity?.claims?.P3383?.[0]?.mainsnak?.datavalue?.value || "";
    const logoName = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value || "";
    const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || "";
    const articleName = entity?.sitelinks?.enwiki?.title || "";
    const article = articleName
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(articleName.replaceAll(" ", "_"))}`
      : "";

    return {
      ...metadata,
      title: isGenericTitle(entry, metadata.title)
        ? entity?.labels?.en?.value || metadata.title
        : metadata.title,
      description:
        metadata.description ||
        entity?.descriptions?.en?.value ||
        "",
      image: isLikelyBadArtwork(entry, metadata, metadata.image)
        ? selectArtworkImage(entry, metadata, [
            { kind: "poster", value: commonsImageUrl(posterName) },
            { kind: "logo", value: commonsImageUrl(logoName) },
            { kind: "image", value: commonsImageUrl(imageName) }
          ])
        : metadata.image || selectArtworkImage(entry, metadata, [
            { kind: "poster", value: commonsImageUrl(posterName) },
            { kind: "logo", value: commonsImageUrl(logoName) },
            { kind: "image", value: commonsImageUrl(imageName) }
          ]),
      article: metadata.article || article,
      wikidata:
        metadata.wikidata ||
        (entity.id ? `https://www.wikidata.org/entity/${entity.id}` : ""),
      resolutionStatus: entity.id ? "resolved" : metadata.resolutionStatus,
      resolvedAt: new Date().toISOString()
    };
  }

  function wikipediaPageMetadata(page, fallbackUrl = "") {
    if (!page || page.missing !== undefined) return null;

    return {
      title: page.title || "",
      description: page.extract || "",
      image:
        page.thumbnail?.source ||
        page.original?.source ||
        "",
      wikipedia: page.fullurl || fallbackUrl,
      categories: (page.categories || []).map(category => category.title || ""),
      imageName: page.pageimage || ""
    };
  }

  async function fetchWikipediaMetadata(articleUrl) {
    const title = articleTitle(articleUrl);
    if (!title) return null;

    const url = new URL(WIKIPEDIA_ENDPOINT);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages|extracts|info|categories");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("redirects", "1");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("piprop", "thumbnail|original|name");
    url.searchParams.set("pithumbsize", "1000");
    url.searchParams.set("cllimit", "max");
    url.searchParams.set("titles", title);
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const payload = await fetchJson(url);
    const page = Object.values(payload?.query?.pages || {})[0];
    return wikipediaPageMetadata(page, articleUrl);
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }


  function artworkText(value) {
    try {
      const url = new URL(String(value || ""));
      return normalizeSearchText(decodeURIComponent(url.pathname));
    } catch {
      return normalizeSearchText(value);
    }
  }

  function meaningfulTitleTokens(value) {
    const ignored = new Set([
      "the", "and", "for", "from", "with", "into", "part", "episode",
      "movie", "film", "television", "series", "season"
    ]);
    return normalizeSearchText(value)
      .split(" ")
      .filter(token => token.length >= 3 && !ignored.has(token));
  }

  function titleSimilarity(left, right) {
    const expected = meaningfulTitleTokens(left);
    const candidate = new Set(meaningfulTitleTokens(right));
    if (expected.length === 0) return 0;
    return expected.filter(token => candidate.has(token)).length / expected.length;
  }

  function isLikelyBadArtwork(entry, metadata, image, sourceKind = "image") {
    if (!image) return false;
    try {
      if (new URL(String(image)).protocol === "file:") return false;
    } catch {
    }
    if (sourceKind === "poster" || sourceKind === "logo") return false;

    const imageText = artworkText(image);
    if (!imageText) return true;

    if (/\b(distribution|diagram|chart|graph|equation|histogram|map|flag|coat of arms|politics|politician|pdf|document|building|headshot|portrait|red carpet|premiere|festival|interview|award ceremony|cast photo|cast group|actor|actress|director|producer|model|football|soccer)\b/.test(imageText)) {
      return true;
    }

    if (/\b(poster|key art|cover|title card|logo|movie still|film still|screenshot|screen shot|scene|promotional|publicity still)\b/.test(imageText)) {
      return false;
    }

    const title = metadata?.title || entry?.title || "";
    const overlap = titleSimilarity(title, imageText);
    return overlap < 0.5;
  }

  function selectArtworkImage(entry, metadata, candidates) {
    for (const candidate of candidates) {
      const value = String(candidate?.value || "").replace(/^http:/, "https:");
      if (!value) continue;
      if (!isLikelyBadArtwork(entry, metadata, value, candidate.kind)) {
        return value;
      }
    }
    return "";
  }

  function isLikelyMediaArticle(entry, metadata, page) {
    const pageTitle = page?.title || "";
    const categories = normalizeSearchText(
      (page?.categories || []).map(category => category.title || category).join(" ")
    );
    const extract = normalizeSearchText(page?.extract || "");
    const combined = `${normalizeSearchText(pageTitle)} ${categories} ${extract}`;
    const expectedTitle = metadata?.title || "";
    const similarity = titleSimilarity(expectedTitle, pageTitle);
    const mediaTerms = entry.mode === "movie"
      ? /\b(film|films|movie|cinema)\b/
      : /\b(television|tv series|television series|miniseries)\b/;
    const personTerms = /\b(living people|births|actors|actresses|film directors|television directors|models|people from|american male|american female|british male|british female)\b/;

    if (personTerms.test(categories)) return false;
    if (!mediaTerms.test(combined)) return false;
    return similarity >= 0.6 || normalizeSearchText(pageTitle) === normalizeSearchText(expectedTitle);
  }

  function slugifyTitle(value) {
    return normalizeSearchText(value).replaceAll(" ", "-");
  }

  function externalCatalogUrls(entry, metadata) {
    const title = metadata?.title || entry?.title || "";
    if (!title || isGenericTitle(entry, title)) {
      return { fastflix: "", seeflix: "", movies123: "" };
    }

    const slug = slugifyTitle(title);
    const fastflixType = entry.mode === "tv" ? "tvshows" : "movies";
    return {
      fastflix: `https://fastflix.to/${fastflixType}/${slug}/`,
      seeflix: `https://ww4.seeflix.to/${slug}/`,
      movies123: `https://ww8.123moviesfree.net/search/${slug}/`
    };
  }

  function wikipediaSearchQueries(entry, metadata) {
    const queries = [];
    const add = value => {
      const normalized = String(value || "").trim();
      if (normalized && !queries.includes(normalized)) {
        queries.push(normalized);
      }
    };

    const title = isGenericTitle(entry, metadata.title)
      ? ""
      : metadata.title;
    const type = entry.mode === "movie" ? "film" : "television series";
    const year = String(metadata.year || "").slice(0, 4);
    const imdb = metadata.imdb || (/^tt\d+$/i.test(entry.id) ? entry.id : "");
    const tmdb = metadata.tmdb || (/^\d+$/.test(entry.id) ? entry.id : "");

    if (imdb) add(`\"${imdb}\"`);
    if (title && year) add(`\"${title}\" ${year} ${type}`);
    if (title) add(`\"${title}\" ${type}`);
    if (title && year) add(`${title} ${year}`);
    if (title) add(title);
    if (tmdb) add(`\"${tmdb}\" ${type}`);

    return queries;
  }

  function scoreWikipediaCandidate(entry, metadata, page) {
    if (!isLikelyMediaArticle(entry, metadata, page)) {
      return -180;
    }

    const title = normalizeSearchText(page?.title);
    const expectedTitle = normalizeSearchText(metadata?.title);
    const extract = normalizeSearchText(page?.extract);
    const categories = normalizeSearchText(
      (page?.categories || []).map(category => category.title || category).join(" ")
    );
    const combined = `${title} ${extract} ${categories}`;
    const year = String(metadata?.year || "").slice(0, 4);
    const imdb = String(metadata?.imdb || (/^tt\d+$/i.test(entry.id) ? entry.id : "")).toLowerCase();
    const image = page?.thumbnail?.source || page?.original?.source || "";
    const imageName = page?.pageimage || "";

    let score = 0;
    if (image && !isLikelyBadArtwork(entry, metadata, imageName || image)) score += 42;
    if (expectedTitle && title === expectedTitle) score += 90;
    else if (expectedTitle && title.includes(expectedTitle)) score += 52;
    else if (expectedTitle && expectedTitle.includes(title)) score += 32;

    if (year && combined.includes(year)) score += 22;
    if (imdb && combined.includes(imdb)) score += 80;
    if (/disambiguation|list of|episode list/.test(combined)) score -= 120;
    if (/soundtrack|novel|video game|album/.test(title) && entry.mode === "movie") score -= 50;
    if (image && isLikelyBadArtwork(entry, metadata, imageName || image)) score -= 100;

    return score;
  }

  async function searchWikipediaMetadata(entry, metadata) {
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const query of wikipediaSearchQueries(entry, metadata)) {
      const url = new URL(WIKIPEDIA_ENDPOINT);
      url.searchParams.set("action", "query");
      url.searchParams.set("generator", "search");
      url.searchParams.set("gsrsearch", query);
      url.searchParams.set("gsrnamespace", "0");
      url.searchParams.set("gsrlimit", String(WIKIPEDIA_SEARCH_LIMIT));
      url.searchParams.set("prop", "pageimages|extracts|info|categories");
      url.searchParams.set("inprop", "url");
      url.searchParams.set("exintro", "1");
      url.searchParams.set("explaintext", "1");
      url.searchParams.set("piprop", "thumbnail|original|name");
      url.searchParams.set("pithumbsize", "1000");
      url.searchParams.set("cllimit", "max");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");

      const payload = await fetchJson(url);
      const pages = Object.values(payload?.query?.pages || {});

      for (const page of pages) {
        const score = scoreWikipediaCandidate(entry, metadata, page);
        if (score > bestScore) {
          bestScore = score;
          best = wikipediaPageMetadata(page);
        }
      }

      if (best?.image && bestScore >= 90) {
        break;
      }
    }

    const minimumScore = isGenericTitle(entry, metadata.title) ? 105 : 75;
    return bestScore >= minimumScore ? best : null;
  }

  function mergeWikipedia(entry, metadata, wikipedia) {
    if (!wikipedia) return metadata;

    const wikipediaImage = isLikelyBadArtwork(
      entry,
      metadata,
      wikipedia.imageName || wikipedia.image
    )
      ? ""
      : wikipedia.image || "";

    return {
      ...metadata,
      title: isGenericTitle(entry, metadata.title)
        ? wikipedia.title || metadata.title
        : metadata.title,
      description: metadata.description || wikipedia.description || "",
      image: isLikelyBadArtwork(entry, metadata, metadata.image)
        ? wikipediaImage
        : metadata.image || wikipediaImage,
      wikipedia: wikipedia.wikipedia || metadata.article || "",
      resolutionStatus: metadata.wikidata || wikipedia.title
        ? "resolved"
        : metadata.resolutionStatus,
      resolvedAt: new Date().toISOString()
    };
  }


  async function searchCommonsArtwork(entry, metadata) {
    const title = isGenericTitle(entry, metadata.title) ? "" : metadata.title;
    if (!title) return "";

    const queries = [
      `${title} film poster`,
      `${title} television poster`,
      `${title} title logo`,
      `${title} film still`
    ];
    let best = "";
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const query of queries) {
      const url = new URL(COMMONS_ENDPOINT);
      url.searchParams.set("action", "query");
      url.searchParams.set("generator", "search");
      url.searchParams.set("gsrsearch", query);
      url.searchParams.set("gsrnamespace", "6");
      url.searchParams.set("gsrlimit", "8");
      url.searchParams.set("prop", "imageinfo");
      url.searchParams.set("iiprop", "url");
      url.searchParams.set("iiurlwidth", "1000");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");

      const payload = await fetchJson(url);
      for (const page of Object.values(payload?.query?.pages || {})) {
        const image = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || "";
        const filename = page?.title || image;
        if (!image || isLikelyBadArtwork(entry, metadata, filename)) continue;

        let score = Math.round(titleSimilarity(title, filename) * 100);
        const normalized = normalizeSearchText(filename);
        if (/\bposter|key art|cover\b/.test(normalized)) score += 70;
        if (/\blogo|title card\b/.test(normalized)) score += 45;
        if (/\bstill|scene|screenshot\b/.test(normalized)) score += 25;
        if (score > bestScore) {
          bestScore = score;
          best = image;
        }
      }
      if (bestScore >= 120) break;
    }

    return bestScore >= 75 ? best : "";
  }

  async function enrichMetadata(entry, metadata) {
    let enriched = metadata;

    if (needsRepair({ ...entry, ...enriched }) && enriched.wikidata) {
      try {
        enriched = mergeWikidataEntity(
          entry,
          enriched,
          await fetchWikidataEntity(enriched)
        );
      } catch {
        // Continue to Wikipedia repair.
      }
    }

    if (needsRepair({ ...entry, ...enriched }) && enriched.article) {
      try {
        enriched = mergeWikipedia(
          entry,
          enriched,
          await fetchWikipediaMetadata(enriched.article)
        );
      } catch {
        // Continue to scored Wikipedia search.
      }
    }

    if (needsRepair({ ...entry, ...enriched })) {
      try {
        enriched = mergeWikipedia(
          entry,
          enriched,
          await searchWikipediaMetadata(entry, enriched)
        );
      } catch {
        // Preserve the strongest metadata already found.
      }
    }

    if (!enriched.image || isLikelyBadArtwork(entry, enriched, enriched.image)) {
      try {
        enriched = {
          ...enriched,
          image: await searchCommonsArtwork(entry, enriched)
        };
      } catch {
        enriched = { ...enriched, image: "" };
      }
    }

    if (isLikelyBadArtwork(entry, enriched, enriched.image)) {
      enriched = { ...enriched, image: "" };
    }

    return enriched;
  }

  async function resolve(entry) {
    const normalized = normalizeEntry(entry);
    const data = await runSparql(metadataQuery(normalized));
    const metadata = metadataFromBinding(
      normalized,
      data?.results?.bindings?.[0]
    );
    return enrichMetadata(normalized, metadata);
  }

  async function mapLimit(items, limit, worker) {
    let cursor = 0;
    const runners = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (cursor < items.length) {
          const index = cursor++;
          await worker(items[index], index);
        }
      }
    );
    await Promise.all(runners);
  }

  async function resolveMany(entries, limit = 3, onResolved = null) {
    const results = new Array(entries.length);
    await mapLimit(entries, limit, async (entry, index) => {
      const metadata = await resolve(entry);
      results[index] = metadata;
      await onResolved?.(entry, metadata, index);
    });
    return results;
  }

  function relatedQuery(entry, metadata) {
    const genreUris = (metadata.genreUris || [])
      .filter(value => /^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(value))
      .slice(0, 3);

    if (genreUris.length === 0) {
      return "";
    }

    const identifier = entry.mode === "movie" ? "movieTmdb" : "tvTmdb";
    const property = entry.mode === "movie" ? "P4947" : "P4983";
    const values = genreUris.map(value => `<${value}>`).join(" ");
    const exclusion = /^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(
      metadata.wikidata || ""
    )
      ? `FILTER(?item != <${metadata.wikidata}>)`
      : "";

    return `SELECT DISTINCT ?item ?itemLabel ?itemDescription ?date ?image
             ?imdb ?${identifier} ?article WHERE {
      VALUES ?genre { ${values} }
      ?item wdt:P136 ?genre;
            wdt:${property} ?${identifier}.
      ${exclusion}
      OPTIONAL { ?item wdt:P577 ?date. }
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
    LIMIT 36`;
  }

  async function related(entry, metadata) {
    const query = relatedQuery(entry, metadata);
    if (!query) return [];

    const data = await runSparql(query);
    const seen = new Set();
    const results = [];

    for (const binding of data?.results?.bindings || []) {
      const tmdb = entry.mode === "movie"
        ? bindingValue(binding, "movieTmdb")
        : bindingValue(binding, "tvTmdb");
      const imdb = bindingValue(binding, "imdb");
      const id = imdb || tmdb;
      if (!id) continue;

      const key = `${entry.mode}|${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        baseUrl: entry.baseUrl,
        mode: entry.mode,
        id,
        season: entry.mode === "tv" ? 1 : undefined,
        episode: entry.mode === "tv" ? 1 : undefined,
        title: bindingValue(binding, "itemLabel") || (
          entry.mode === "movie" ? `Movie ${id}` : `TV ${id}`
        ),
        description: bindingValue(binding, "itemDescription"),
        year: bindingValue(binding, "date").slice(0, 4),
        image: selectArtworkImage({ mode: entry.mode, id }, {
          title: bindingValue(binding, "itemLabel") || (

            entry.mode === "movie" ? `Movie ${id}` : `TV ${id}`
          )
        }, [
          { kind: "image", value: bindingValue(binding, "image") }
        ]),
        imdb,
        tmdb,
        wikidata: bindingValue(binding, "item"),
        article: bindingValue(binding, "article"),
        wikipedia: "",
        genres: [],
        genreUris: [],
        resolutionStatus: "resolved"
      });

      if (results.length >= RELATED_REPAIR_LIMIT) break;
    }

    await mapLimit(results, 3, async (candidate, index) => {
      if (!needsRepair(candidate)) return;
      results[index] = {
        ...candidate,
        ...await enrichMetadata(candidate, candidate)
      };
    });

    return results;
  }

  function imdbUrl(metadata) {
    return metadata?.imdb
      ? `https://www.imdb.com/title/${encodeURIComponent(metadata.imdb)}/`
      : "";
  }

  function tmdbUrl(entry, metadata) {
    if (!metadata?.tmdb) return "";
    const type = entry.mode === "movie" ? "movie" : "tv";
    return `https://www.themoviedb.org/${type}/${encodeURIComponent(metadata.tmdb)}`;
  }

  globalThis.VidCoreMetadata = Object.freeze({
    normalizeBaseUrl,
    normalizeId,
    normalizeEntry,
    entryKey,
    fallbackTitle,
    buildPlayerUrl,
    isGenericTitle,
    needsRepair,
    runSparql,
    resolve,
    resolveMany,
    related,
    imdbUrl,
    tmdbUrl,
    bindingValue,
    wikipediaSearchQueries,
    scoreWikipediaCandidate,
    mergeWikidataEntity,
    mergeWikipedia,
    isLikelyBadArtwork,
    selectArtworkImage,
    externalCatalogUrls
  });
})();
