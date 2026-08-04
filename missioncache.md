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

## Open / provider-limited

- [ ] Exact playback position requires a provider-supported cross-origin messaging API.
- [ ] Provider availability and stream quality remain controlled by the configured provider.
- [ ] A browser page cannot inject popup protection into a cross-origin provider iframe.
- [ ] Metadata can remain incomplete when no matching Wikidata or English Wikipedia entry exists.
- [ ] Optional cloud synchronization requires a user-owned backend or account provider.
