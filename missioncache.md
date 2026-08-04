# Mission Cache

## Completed

- [x] Keep the C++23 desktop and browser players in one dedicated repository.
- [x] Separate them as `VidCoreNativePlayer/` and `VidCoreWebPlayer/`.
- [x] Remove the old `Large` naming.
- [x] Make Database Pick the default Random mode.
- [x] Keep Favorites permanent immediately after All.
- [x] Add a dedicated Favorites tab beside Library, Continue, Recommended, and Related.
- [x] Move Delete from media cards into the Edit dialog.
- [x] Restore stronger artwork lookup with direct Wikidata entity and Wikipedia search fallbacks.
- [x] Repair missing related-title artwork with bounded concurrency.
- [x] Preserve native WebView2 popup, new-window, and navigation-hijack interception.
- [x] Preserve named lists, notes, watched state, filtering, Continue Watching, recommendations, related titles, and JSON backup.
- [x] Preserve build, run, clean, and validation scripts for the native project.
- [x] Add a localhost run script for the web project.
- [x] Add a repeatable Windows release workflow driven by the root `VERSION` file.
- [x] Validate and build the native C++23 project with Visual Studio 2022 on GitHub Actions.
- [x] Publish release `v0.2.1` with separate native Windows x64 and web-player ZIPs plus SHA-256 checksums.
- [x] Add VidCore, YTHD, and VidUp provider choices in that order to both players.
- [x] Add provider-aware movie and TV URL construction.
- [x] Add Pause directly beside Play in both players.
- [x] Make main Play use the selected provider and saved-card Play use each title's saved provider.
- [x] Add compact version 2 backups with provider categories stored once and per-title provider indexes.
- [x] Preserve import compatibility with version 1 backups containing full `baseUrl` values.
- [x] Add provider, pause, compact-backup, and legacy-import validation.
- [x] Publish release `v0.2.2` with refreshed native and web-player assets.
- [x] Correct the follow-up release version and publish `v0.2.3`.

- [x] Move the provider/play controls back to the top while keeping the resolve metadata card below Stop/transport.
- [x] Bundle the supplied 105-title, 24-list library into both players.
- [x] Merge only previously unseen built-in titles and lists without overwriting edits or restoring deleted seed items.
- [x] Publish release `v0.2.4` with the built-in starter library.


- [x] Reject mismatched Wikipedia diagrams, person portraits, cast photos, red-carpet images, and unrelated subject artwork.
- [x] Prefer exact-title Wikidata poster/logo properties and add a strict Wikimedia Commons artwork fallback.
- [x] Remove already-saved mismatched artwork non-destructively while preserving lists, notes, and watched state.
- [x] Display resolved artwork with its full aspect ratio instead of cropping it.
- [x] Add FastFlix, SeeFlix, and 123Movies lookup buttons to the current metadata card and saved media cards.
- [x] Correct right-sidebar card/button wrapping and current-card action formatting across desktop and collapsed layouts.
- [x] Keep the native WebView2 profile, image/browser cache, IndexedDB, localStorage, popup history, and settings in `data/` beside the executable.
- [x] Resolve native assets relative to the executable instead of the launch working directory.
- [x] Publish release `v0.2.5` with artwork validation, external catalog links, top provider controls, corrected formatting, and portable storage.

## Open / provider-limited

- [ ] Exact playback position requires a provider-supported cross-origin messaging API.
- [ ] Provider availability and stream quality remain controlled by the configured provider.
- [ ] A browser page cannot inject popup protection into a cross-origin provider iframe.
- [ ] Metadata can remain incomplete when no matching Wikidata or English Wikipedia entry exists.
- [ ] Optional cloud synchronization requires a user-owned backend or account provider.
