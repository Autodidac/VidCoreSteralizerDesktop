# Mission Cache

## Completed in v0.2.1

- [x] Publish the native C++23 player as the standalone `Autodidac/VidCoreSteralizerDesktop` repository.
- [x] Make Database pick the default Random mode and persist the selection.
- [x] Keep `Favorites` permanent immediately after `All` in list controls.
- [x] Add a dedicated Favorites sidebar tab.
- [x] Move library deletion out of card actions and into the Edit dialog.
- [x] Add direct Wikidata entity fallback for images and English Wikipedia sitelinks.
- [x] Add scored Wikipedia search fallback when an exact article or image is missing.
- [x] Repair missing related-title artwork with bounded concurrency.
- [x] Preserve the working C++23 module and WebView2 native shell from v0.1.2.
- [x] Preserve the fixed single-manifest linker configuration.
- [x] Preserve explicit COM headers under `WIN32_LEAN_AND_MEAN`.
- [x] Restore configurable movie and TV playback.
- [x] Restore metadata-first Previous and Next scanning.
- [x] Restore Random ID and public-database discovery modes.
- [x] Keep unresolved scan candidates out of the provider iframe.
- [x] Add scan cancellation and throttled public metadata requests.
- [x] Restore Wikidata metadata resolution.
- [x] Restore Wikipedia name, description, and cover-art repair.
- [x] Restore related title discovery.
- [x] Restore rolling Recommended discoveries.
- [x] Restore IndexedDB with localStorage fallback.
- [x] Restore named lists and list counts.
- [x] Restore notes, watched state, filtering, and list-wide metadata repair.
- [x] Restore Continue Watching with manual completion.
- [x] Restore JSON import and export.
- [x] Migrate compatible v0.1.x native favorites and recent history.
- [x] Add native opening for trusted IMDb, TMDB, Wikipedia, and Wikidata links.
- [x] Preserve native popup/new-window interception.
- [x] Preserve top-level navigation hijack prevention.
- [x] Preserve document-created popup guarding in child frames.
- [x] Add JavaScript and static feature validation.
- [x] Keep build, run, clean, and validation scripts.

## Open / provider-limited

- [ ] Exact playback position requires a provider-supported cross-origin messaging API.
- [ ] Provider availability and stream quality remain controlled by the configured provider.
- [ ] Visual ads rendered inside the provider frame are not guaranteed to be removed.
- [ ] Metadata can remain incomplete when no matching Wikidata or English Wikipedia entry exists.
- [ ] Optional cloud synchronization requires a user-owned backend or account provider.
