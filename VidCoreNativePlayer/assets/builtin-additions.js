"use strict";

(() => {
  const previous = globalThis.VidCoreBuiltInLibraryPromise ??
    Promise.resolve(globalThis.VidCoreBuiltInLibrary ?? {});

  const additions = [
    {
      "mode": "tv",
      "id": "119051",
      "season": 1,
      "episode": 1,
      "title": "Wednesday",
      "description": "American horror comedy television series",
      "year": "",
      "image": "",
      "imdb": "tt13443470",
      "tmdb": "119051",
      "genres": [
        "comedy horror film",
        "fantasy television series",
        "thriller television series",
        "comedy television series",
        "youth series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q108466999",
        "http://www.wikidata.org/entity/Q98526245",
        "http://www.wikidata.org/entity/Q67175872",
        "http://www.wikidata.org/entity/Q9335576",
        "http://www.wikidata.org/entity/Q1711400"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q105553568",
      "article": "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      "wikipedia": "https://en.wikipedia.org/wiki/Wednesday_(TV_series)",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T12:25:40.691Z",
      "list": "Comedy",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T12:26:21.024Z",
      "updatedAt": "2026-08-04T12:26:21.024Z"
    },
    {
      "mode": "tv",
      "id": "157741",
      "season": 1,
      "episode": 1,
      "title": "Landman",
      "description": "American television series",
      "year": "",
      "image": "",
      "imdb": "tt14186672",
      "tmdb": "157741",
      "genres": [
        "neo-Western",
        "drama television series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q116955088",
        "http://www.wikidata.org/entity/Q1366112"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q124447212",
      "article": "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      "wikipedia": "https://en.wikipedia.org/wiki/Landman_(TV_series)",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T12:10:44.849Z",
      "list": "Western",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T12:00:08.168Z",
      "updatedAt": "2026-08-04T12:11:02.863Z"
    },
    {
      "mode": "tv",
      "id": "290295",
      "season": 1,
      "episode": 1,
      "title": "Mating Season",
      "description": "2026 adult animated American television series",
      "year": "2026",
      "image": "",
      "imdb": "tt14690136",
      "tmdb": "290295",
      "genres": [
        "adult animated television series",
        "comedy television series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q138600175",
        "http://www.wikidata.org/entity/Q9335576"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q139387446",
      "article": "https://en.wikipedia.org/wiki/Mating_Season",
      "wikipedia": "https://en.wikipedia.org/wiki/Mating_Season",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T11:48:04.226Z",
      "list": "Comedy",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T11:52:17.985Z",
      "updatedAt": "2026-08-04T11:52:17.985Z"
    },
    {
      "mode": "tv",
      "id": "108978",
      "season": 1,
      "episode": 1,
      "title": "Reacher",
      "description": "television series",
      "year": "",
      "image": "https://commons.wikimedia.org/wiki/Special:FilePath/Reacher%20series%20title%20card.png",
      "imdb": "tt9288030",
      "tmdb": "108978",
      "genres": [
        "thriller television series",
        "detective television series",
        "crime television series",
        "drama television series",
        "action television series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q67175872",
        "http://www.wikidata.org/entity/Q56878968",
        "http://www.wikidata.org/entity/Q9335577",
        "http://www.wikidata.org/entity/Q1366112",
        "http://www.wikidata.org/entity/Q343782"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q109901438",
      "article": "https://en.wikipedia.org/wiki/Reacher_(TV_series)",
      "wikipedia": "",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T13:43:31.263Z",
      "list": "Crime",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T13:45:05.355Z",
      "updatedAt": "2026-08-04T13:45:05.355Z"
    },
    {
      "mode": "tv",
      "id": "259909",
      "season": 1,
      "episode": 1,
      "title": "Dexter: Resurrection",
      "description": "2025 television series",
      "year": "",
      "image": "https://commons.wikimedia.org/wiki/Special:FilePath/Dexter%20Resurrection%20logo.png",
      "imdb": "tt33043892",
      "tmdb": "259909",
      "genres": [
        "crime drama film",
        "mystery fiction",
        "crime film"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q113485322",
        "http://www.wikidata.org/entity/Q6585139",
        "http://www.wikidata.org/entity/Q959790"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q127919404",
      "article": "https://en.wikipedia.org/wiki/Dexter:_Resurrection",
      "wikipedia": "",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T13:26:22.544Z",
      "list": "Crime",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T13:10:19.358Z",
      "updatedAt": "2026-08-04T13:26:22.544Z"
    },
    {
      "mode": "tv",
      "id": "90802",
      "season": 1,
      "episode": 1,
      "title": "The Sandman",
      "description": "2022 American fantasy drama television series",
      "year": "",
      "image": "https://commons.wikimedia.org/wiki/Special:FilePath/The%20Sandman%20logo.png",
      "imdb": "tt1751634",
      "tmdb": "90802",
      "genres": [
        "fantasy television series",
        "drama television series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q98526245",
        "http://www.wikidata.org/entity/Q1366112"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q92590789",
      "article": "https://en.wikipedia.org/wiki/The_Sandman_(TV_series)",
      "wikipedia": "",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T13:46:39.175Z",
      "list": "Fantasy",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T14:14:05.078Z",
      "updatedAt": "2026-08-04T14:14:05.078Z"
    },
    {
      "mode": "tv",
      "id": "277439",
      "season": 1,
      "episode": 1,
      "title": "Cape Fear",
      "description": "American television series",
      "year": "",
      "image": "https://commons.wikimedia.org/wiki/Special:FilePath/Cape%20Fear%20%28tv%20series%20logo%29.svg",
      "imdb": "tt34675596",
      "tmdb": "277439",
      "genres": [
        "crime television series",
        "drama television series",
        "thriller television series"
      ],
      "genreUris": [
        "http://www.wikidata.org/entity/Q9335577",
        "http://www.wikidata.org/entity/Q1366112",
        "http://www.wikidata.org/entity/Q67175872"
      ],
      "wikidata": "http://www.wikidata.org/entity/Q134126367",
      "article": "https://en.wikipedia.org/wiki/Cape_Fear_(TV_series)",
      "wikipedia": "",
      "resolutionStatus": "resolved",
      "resolvedAt": "2026-08-04T17:43:28.163Z",
      "list": "Crime",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T17:29:54.566Z",
      "updatedAt": "2026-08-04T17:43:28.163Z"
    },
    {
      "mode": "tv",
      "id": "298714",
      "season": 1,
      "episode": 1,
      "title": "TV 298714 · S1 E1",
      "description": "No matching Wikidata metadata was found.",
      "year": "",
      "image": "",
      "imdb": "",
      "tmdb": "298714",
      "genres": [],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "not-found",
      "resolvedAt": "2026-08-04T17:43:27.880Z",
      "list": "Other",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T17:29:04.129Z",
      "updatedAt": "2026-08-04T17:43:27.925Z"
    },
    {
      "mode": "tv",
      "id": "319179",
      "season": 1,
      "episode": 1,
      "title": "TV 319179 · S1 E1",
      "description": "No matching Wikidata metadata was found.",
      "year": "",
      "image": "",
      "imdb": "",
      "tmdb": "319179",
      "genres": [],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "not-found",
      "resolvedAt": "2026-08-04T17:51:21.995Z",
      "list": "Documentary",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-04T17:51:13.657Z",
      "updatedAt": "2026-08-04T17:51:22.089Z",
      "provider": 1
    },
    {
      "mode": "movie",
      "id": "85",
      "title": "Raiders of the Lost Ark",
      "description": "1981 action-adventure film",
      "year": "1981",
      "image": "",
      "imdb": "tt0082971",
      "tmdb": "85",
      "genres": [
        "action film",
        "adventure film"
      ],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "unresolved",
      "list": "Action",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-05T14:12:00.000Z",
      "updatedAt": "2026-08-05T14:12:00.000Z"
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
      "genres": [
        "action film",
        "adventure film"
      ],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "unresolved",
      "list": "Action",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-05T14:12:00.000Z",
      "updatedAt": "2026-08-05T14:12:00.000Z"
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
      "genres": [
        "action film",
        "adventure film"
      ],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "unresolved",
      "list": "Action",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-05T14:12:00.000Z",
      "updatedAt": "2026-08-05T14:12:00.000Z"
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
      "genres": [
        "action film",
        "adventure film"
      ],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "unresolved",
      "list": "Action",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-05T14:12:00.000Z",
      "updatedAt": "2026-08-05T14:12:00.000Z"
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
      "genres": [
        "action film",
        "adventure film"
      ],
      "genreUris": [],
      "wikidata": "",
      "article": "",
      "wikipedia": "",
      "resolutionStatus": "unresolved",
      "list": "Action",
      "notes": "",
      "watched": false,
      "createdAt": "2026-08-05T14:12:00.000Z",
      "updatedAt": "2026-08-05T14:12:00.000Z"
    }
  ];

  const listAdditions = [
    {
      "name": "Fantasy",
      "createdAt": "2026-08-04T14:14:01.359Z"
    }
  ];

  function identity(entry) {
    return [
      Number.isInteger(entry.provider) ? entry.provider : 0,
      entry.mode,
      entry.id,
      entry.mode === "tv" ? entry.season ?? 1 : "",
      entry.mode === "tv" ? entry.episode ?? 1 : ""
    ].join("|");
  }

  globalThis.VidCoreBuiltInLibraryPromise = Promise.resolve(previous).then(payload => {
    const favorites = Array.isArray(payload?.favorites) ? payload.favorites : [];
    const knownFavorites = new Set(favorites.map(identity));
    const mergedFavorites = [...favorites];

    for (const entry of additions) {
      if (!knownFavorites.has(identity(entry))) {
        knownFavorites.add(identity(entry));
        mergedFavorites.push(entry);
      }
    }

    const lists = Array.isArray(payload?.lists) ? payload.lists : [];
    const knownLists = new Set(lists.map(list => String(list?.name || "").trim()));
    const mergedLists = [...lists];

    for (const list of listAdditions) {
      const name = String(list?.name || "").trim();
      if (name && !knownLists.has(name)) {
        knownLists.add(name);
        mergedLists.push(list);
      }
    }

    return {
      ...payload,
      exportedAt: payload?.exportedAt || "2026-08-05T14:12:00.000Z",
      favorites: mergedFavorites,
      lists: mergedLists
    };
  });
})();
