import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

function loadScript(name, context) {
  const source = fs.readFileSync(
    path.join(root, "assets", name),
    "utf8"
  );
  vm.runInContext(source, context, { filename: name });
}

const storage = new Map();
const context = vm.createContext({
  console,
  URL,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  AbortController,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  }
});
context.globalThis = context;

loadScript("metadata.js", context);
loadScript("scanner.js", context);

const metadata = context.VidCoreMetadata;
const scanner = context.VidCoreScanner;

assert.deepEqual(
  JSON.parse(JSON.stringify(metadata.normalizeEntry({
    baseUrl: "https://vidcore.net/",
    mode: "movie",
    id: "00123"
  }))),
  {
    baseUrl: "https://vidcore.net",
    mode: "movie",
    id: "123"
  }
);

assert.deepEqual(
  JSON.parse(JSON.stringify(metadata.normalizeEntry({
    baseUrl: "https://vidcore.net",
    mode: "tv",
    id: "44217",
    season: "1",
    episode: "2"
  }))),
  {
    baseUrl: "https://vidcore.net",
    mode: "tv",
    id: "44217",
    season: 1,
    episode: 2
  }
);

assert.match(
  metadata.buildPlayerUrl({
    baseUrl: "https://vidcore.net",
    mode: "movie",
    id: "1198994"
  }),
  /^https:\/\/vidcore\.net\/movie\/1198994\?/
);

const searchQueries = metadata.wikipediaSearchQueries(
  {
    baseUrl: "https://vidcore.net",
    mode: "movie",
    id: "1198994"
  },
  {
    title: "Example Film",
    year: "2025",
    imdb: "tt1234567",
    tmdb: "1198994"
  }
);
assert.equal(searchQueries[0], '"tt1234567"');
assert.ok(searchQueries.some(query => query.includes("Example Film")));

const strongCandidateScore = metadata.scoreWikipediaCandidate(
  { mode: "movie", id: "1198994" },
  { title: "Example Film", year: "2025", imdb: "tt1234567" },
  {
    title: "Example Film",
    extract: "Example Film is a 2025 film with IMDb identifier tt1234567.",
    thumbnail: { source: "https://example.invalid/poster.jpg" },
    categories: [{ title: "Category:2025 films" }]
  }
);
const weakCandidateScore = metadata.scoreWikipediaCandidate(
  { mode: "movie", id: "1198994" },
  { title: "Example Film", year: "2025", imdb: "tt1234567" },
  {
    title: "Example Film (disambiguation)",
    extract: "A disambiguation page.",
    categories: []
  }
);
assert.ok(strongCandidateScore > weakCandidateScore);

assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "Normal" },
    { title: "Normal" },
    "https://upload.wikimedia.org/normal-distribution-diagram.svg"
  ),
  true
);
assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "1", title: "Example Film" },
    { title: "Example Film" },
    "https://upload.wikimedia.org/example-film-poster.jpg"
  ),
  false
);
const catalogs = metadata.externalCatalogUrls(
  { mode: "tv", id: "1" },
  { title: "Mating Season" }
);
assert.match(catalogs.fastflix, /fastflix\.to\/tvshows\/mating-season/);
assert.match(catalogs.seeflix, /seeflix\.to\/mating-season/);
assert.match(catalogs.movies123, /123moviesfree\.net\/search\/mating-season/);
const wikipediaMerge = metadata.mergeWikipedia(
  { mode: "movie", id: "1", title: "Example Film" },
  { title: "Example Film", image: "", resolutionStatus: "resolved" },
  {
    title: "Example Film",
    imageName: "Example Film poster.jpg",
    image: "https://upload.wikimedia.org/example-film-poster.jpg"
  }
);
assert.equal(
  wikipediaMerge.image,
  "https://upload.wikimedia.org/example-film-poster.jpg"
);

const entityMerge = metadata.mergeWikidataEntity(
  { mode: "movie", id: "1198994" },
  {
    title: "Movie 1198994",
    description: "",
    image: "",
    article: "",
    wikidata: "https://www.wikidata.org/entity/Q1",
    resolutionStatus: "not-found"
  },
  {
    id: "Q1",
    labels: { en: { value: "Example Film" } },
    descriptions: { en: { value: "2025 film" } },
    claims: {
      P18: [{ mainsnak: { datavalue: { value: "Example Poster.jpg" } } }]
    },
    sitelinks: { enwiki: { title: "Example Film" } }
  }
);
assert.equal(entityMerge.title, "Example Film");
assert.match(entityMerge.image, /Special:FilePath/);
assert.match(entityMerge.article, /en\.wikipedia\.org\/wiki\/Example_Film/);

assert.match(
  scanner.neighborPickQuery("movie", 100, 1),
  /wdt:P4947/
);
assert.match(
  scanner.neighborPickQuery("tv", 100, -1),
  /ORDER BY DESC/
);
assert.match(
  scanner.databaseTitlePickQuery("movie", 2025, 7),
  /YEAR\(\?date\) = 2025/
);

scanner.addResolvedImage({
  baseUrl: "https://vidcore.net",
  mode: "movie",
  id: "1",
  title: "Test",
  image: "https://example.invalid/poster.jpg"
});

assert.equal(scanner.readQueue().length, 1);
assert.equal(scanner.readQueue()[0].title, "Test");

console.log("Metadata repair and scanner logic checks passed.");
