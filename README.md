# VidCore Steralizer Desktop

Two maintained VidCore players live in separate folders:

- [`VidCoreNativePlayer/`](VidCoreNativePlayer/) — C++23 modules, Win32, and WebView2 with native popup/new-window interception.
- [`VidCoreWebPlayer/`](VidCoreWebPlayer/) — standalone browser version with the same metadata, discovery, and library workflow.

## Current corrections

- Database Pick is the default random mode.
- `All` is followed permanently by `Favorites` in list controls.
- Favorites also has its own top-level tab beside Library, Continue, Recommended, and Related.
- Delete is available only inside the Edit window, away from Play.
- Cover resolution uses Wikidata SPARQL, direct Wikidata entities, exact Wikipedia pages, and scored Wikipedia search fallback.
- Related-title images receive the same bounded repair pass.

Start with the README inside the version you want to run.


## v0.2.2

- Provider order: VidCore, YTHD, VidUp.
- Pause is directly beside Play.
- Saved cards retain their own provider while the main Play uses the currently selected provider.
- New JSON backups use compact provider-indexed backups and still import the version 1 full-URL format.

- v0.2.4 places playback/resolve controls below transport and includes a non-destructive built-in starter library.

## v0.2.15 list durability and Action defaults

- Custom list creation now lives inside Edit/Save.
- Empty custom lists persist until explicitly deleted.
- Saving a title switches Library to its destination list without deleting the list or item.
- Raiders of the Lost Ark and all four Indiana Jones sequels are included in Action defaults.
- The supplied standalone IMDb resolver was reviewed, but its WinHTTP downloader and hidden page automation remain excluded from the shipping player under the Defender-safe boundary.

