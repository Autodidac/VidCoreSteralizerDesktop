"use strict";

(() => {
  const previous = globalThis.VidCoreBuiltInLibraryPromise ??
    Promise.resolve(globalThis.VidCoreBuiltInLibrary ?? {});

  const additions = [
    {
      mode: "tv",
      id: "119051",
      season: 1,
      episode: 1,
      title: "Wednesday",
      description: "American horror comedy television series",
      year: "",
      image: "",
      imdb: "tt13443470",
      tmdb: "119051",
      genres: [
        "comedy horror film",
        "fantasy television series",
        "thriller television series",
        "comedy television series",
        "youth series"
      ],
      genreUris: [
        "http://www.wikidata.org/entity/Q108466999",
        "http://www.wikidata.org/entity/Q98526245",
        "http://www.wikidata.org/entity/Q67175872",
        "http://www.wikidata.org/entity/Q9335576",
        "http://www.wikidata.org/entity/Q1711400"
      ],
      wikidata: "http://www.wikidata.org/entity/Q105553568",
      article: "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      wikipedia: "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      resolutionStatus: "resolved",
      list: "Comedy",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T12:26:21.024Z",
      updatedAt: "2026-08-04T12:26:21.024Z"
    },
    {
      mode: "tv",
      id: "157741",
      season: 1,
      episode: 1,
      title: "Landman",
      description: "American television series",
      year: "",
      image: "",
      imdb: "tt14186672",
      tmdb: "157741",
      genres: ["neo-Western", "drama television series"],
      genreUris: [
        "http://www.wikidata.org/entity/Q116955088",
        "http://www.wikidata.org/entity/Q1366112"
      ],
      wikidata: "http://www.wikidata.org/entity/Q124447212",
      article: "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      wikipedia: "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      resolutionStatus: "resolved",
      list: "Western",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T12:00:08.168Z",
      updatedAt: "2026-08-04T12:11:02.863Z"
    },
    {
      mode: "tv",
      id: "290295",
      season: 1,
      episode: 1,
      title: "Mating Season",
      description: "2026 adult animated American television series",
      year: "2026",
      image: "",
      imdb: "tt14690136",
      tmdb: "290295",
      genres: [
        "adult animated television series",
        "comedy television series"
      ],
      genreUris: [
        "http://www.wikidata.org/entity/Q138600175",
        "http://www.wikidata.org/entity/Q9335576"
      ],
      wikidata: "http://www.wikidata.org/entity/Q139387446",
      article: "https://en.wikipedia.org/wiki/Mating_Season",
      wikipedia: "https://en.wikipedia.org/wiki/Mating_Season",
      resolutionStatus: "resolved",
      list: "Comedy",
      notes: "",
      watched: false,
      createdAt: "2026-08-04T11:52:17.985Z",
      updatedAt: "2026-08-04T11:52:17.985Z"
    }
  ];

  function identity(entry) {
    return [
      entry.mode,
      entry.id,
      entry.mode === "tv" ? entry.season ?? 1 : "",
      entry.mode === "tv" ? entry.episode ?? 1 : ""
    ].join("|");
  }

  globalThis.VidCoreBuiltInLibraryPromise = Promise.resolve(previous).then(payload => {
    const favorites = Array.isArray(payload?.favorites) ? payload.favorites : [];
    const known = new Set(favorites.map(identity));
    const merged = [...favorites];
    for (const entry of additions) {
      if (!known.has(identity(entry))) {
        known.add(identity(entry));
        merged.push(entry);
      }
    }
    return {
      ...payload,
      exportedAt: "2026-08-04T12:26:33.414Z",
      favorites: merged
    };
  });
})();
