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

- [x] Keep both the provider/play controls and compact resolve metadata card above the player.
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

- [x] Keep strict Wikidata, Wikipedia, and Wikimedia Commons artwork only as fallback sources.

- [x] Rename the visible application and native window to `Shielded Native Stream Player`.
- [x] Remove the blocker count while keeping native popup protection active and accessible through Shield details.
- [x] Convert the interface accent theme from purple to blue in both players.
- [x] Make current and library artwork square instead of tall poster slots.
- [x] Reduce the resolve metadata card height and use horizontal wrapping action buttons.
- [x] Keep provider/play controls and the compact resolve card together above the player.
- [x] Add Wednesday, Landman, and Mating Season from the latest backup to built-in defaults without overwriting user edits.
- [x] Preserve non-destructive seed merging so deleted defaults stay deleted and only unseen defaults are added.
- [x] Publish release `v0.2.6` with the completed compact blue redesign and refreshed defaults.
- [x] Remove the native WinHTTP page scraper/downloader and automatic cache-file deletion from the shipping executable after a Windows Defender detection report.
- [x] Keep WebView2 profile data and its normal browser cache under `data/` beside the executable.
- [x] Add a Windows Defender scan report and a source-build ZIP to the release artifacts.

- [x] Put the compact resolve metadata card above the provider/play controls in both players.
- [x] Add an explicit custom-list delete action that preserves saved titles by moving them to Favorites.
- [x] Hide empty custom lists and prune empty list records after they are no longer selected.
- [x] Reconcile the latest supplied backup so all 108 built-in default titles remain included without overwriting user edits.
- [x] Publish release `v0.2.7` with the swapped top sections and list management cleanup.

- [x] Merge every supplied August 4 backup as a union instead of replacing one backup with another.
- [x] Preserve all 111 provider-aware saved entries and all 25 named lists in built-in defaults.
- [x] Add Reacher, Dexter: Resurrection, The Sandman, and the Fantasy list while retaining Wednesday, Landman, and Mating Season.
- [x] Keep built-in history empty so a fresh install does not start with fabricated Continue Watching activity.
- [x] Publish release `v0.2.8` with the complete merged default union.

- [x] Treat the real-user Microsoft Defender detection on v0.2.9 as a release blocker.
- [x] Remove the hidden IMDb/TMDB WebView2 resolver, image-response capture, and portable artwork-file cache from the shipping native executable.
- [x] Restore the known Defender-safe v0.2.8 native network profile while retaining the compact layout, merged defaults, provider logic, and list management.
- [x] Publish release `v0.2.10` after the rollback passed validation, MSVC build, packaging, and the release-runner Defender scan.

- [x] Add a root `AGENTS.md` with durable product invariants, security boundaries, development procedure, release procedure, incident handling, and repository hygiene.
- [x] Remove the redundant custom native source-build ZIP from release packaging and rely on GitHub's automatic source ZIP and TAR.GZ archives.
- [x] Generalize release notes and asset packaging so they describe the current 111-entry, 25-list, zero-history state without stale version-specific claims.
- [x] Publish `v0.2.11` with only the native Windows ZIP, Web-player ZIP, security report, and checksum manifest as custom release assets.
- [x] Confirm the v0.2.11 validation, MSVC build, Defender scan, packaging, and publication workflow completed successfully.
- [x] Confirm no open pull requests remain after the v0.2.11 release.
- [x] Compare the August 5 native backup against the complete built-in identity union instead of replacing prior defaults.
- [x] Add the three genuinely unseen TV defaults: Cape Fear (TMDB 277439), TMDB 298714 S1E1, and TMDB 319179 S1E1.
- [x] Preserve Reacher, The Sandman, The Gentleman Thief, all prior defaults, all 25 lists, and zero seeded history while expanding the built-in library to 114 entries.
- [x] Preserve the failed unpublished v0.2.12 attempt in release history and supersede it with the corrected v0.2.13 release path.
- [x] Publish `v0.2.13` with the 114-entry non-destructive August 4/5 default union.
- [x] Confirm the v0.2.13 validation, MSVC build, Microsoft Defender runner scan, packaging, and publication workflow completed successfully.
- [x] Delete obsolete v0.2.9, v0.2.12 recovery, and v0.2.13 trigger branches so only `main` remains.
- [x] Close the temporary v0.2.13 trigger pull request without merging its trigger file.
- [x] Restore the normal `VERSION`-only release workflow after publication while retaining the 114-entry release notes and corrected asset policy.
- [x] Reproduce the reported artwork mismatch classes from the supplied screenshots: classical-book/title-page art for The Odyssey, an unrelated historical Nobody poster for Nobody 2, and soundtrack art for In the Grey.
- [x] Add local user-owned artwork folders under `data/artwork/<category>/<title [identity]>/` with one random image selected per title per launch and no application-managed download or deletion behavior.
- [x] Convert Favorites into a non-exclusive overlay so titles remain in their normal categories, with legacy Favorites-only records migrated to Uncategorized.
- [x] Repair Related with automatic current-title hydration, public genre-label fallback, and local-library genre/category fallback.
- [x] Tighten artwork acceptance around sequel numbers, conflicting years, article media type, book/title-page imagery, historical source material, soundtrack/album art, and unrelated posters.
- [x] Resolve an exact Wikidata entity's title before validating its artwork so valid title-matching posters are not compared against generic Movie/TV ID placeholders.
- [x] Update scanner test artwork to carry the resolved title identity instead of relying on an unqualified poster filename that production now rejects.
- [x] Supersede the unverified v0.2.13 Windows artifact with v0.2.14 before local endpoint verification.
- [x] Publish `v0.2.14` with local artwork folders, Favorites overlay semantics, Related repair, and stricter artwork identity validation.
- [x] Confirm the v0.2.14 validation, MSVC build, Microsoft Defender runner scan, packaging, and publication workflow completed successfully.
- [x] Remove the temporary v0.2.14 dispatcher and cleanup workflows, delete the trigger branch, and close the trigger pull request without merging it.
- [x] Confirm only `main` remains after v0.2.14 release cleanup.

## Open / provider-limited

- [ ] Verify the downloadable v0.2.14 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.
- [ ] Reintroduce IMDb/TMDB multi-poster browsing only through an independently verified or signed implementation that does not trigger endpoint protection.
- [ ] Add Authenticode signing or Microsoft Store distribution so new native binaries can build publisher reputation.
- [ ] Exact playback position requires a provider-supported cross-origin messaging API.
- [ ] Provider availability and stream quality remain controlled by the configured provider.
- [ ] A browser page cannot inject popup protection into a cross-origin provider iframe.
- [ ] Metadata can remain incomplete when no matching Wikidata or English Wikipedia entry exists.
- [ ] Optional cloud synchronization requires a user-owned backend or account provider.
