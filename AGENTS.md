# AGENTS.md

## Purpose

This file is the operating guide for agents working in `Autodidac/VidCoreSteralizerDesktop`.

The repository contains two synchronized applications:

- `VidCoreNativePlayer/`: C++23 modular Windows desktop application using WebView2.
- `VidCoreWebPlayer/`: browser-hosted version of the same player and library interface.

Preserve the project spelling `VidCoreSteralizerDesktop` exactly.

## Sources of truth

Before changing anything, read these files in order:

1. `AGENTS.md`
2. `missioncache.md`
3. `VERSION`
4. `RELEASE_STATUS.md`
5. `.github/workflows/release.yml`

`missioncache.md` is the durable mission ledger. Unfinished, rejected, deferred, provider-limited, or security-blocked work must remain open. Never silently remove an unfinished mission to make a release appear complete.

`VERSION` and `VidCoreNativePlayer/CMakeLists.txt` must always contain the same semantic version. `RELEASE_STATUS.md` is the final publication authority; do not report a release as complete until it records `Status: success` for the intended version.

## Product invariants

Keep these behaviors unless the user explicitly changes them:

- Visible application name: `Shielded Native Stream Player`.
- Provider order: VidCore, YTHD, VidUp, then YouTube.
- Main Play uses the currently selected provider.
- Saved-card Play uses the provider stored with that entry.
- The compact current/resolve card stays above the provider/play controls.
- The interface uses the blue theme and square artwork slots.
- Favorites is permanent and acts as an overlay; favoriting a title never removes its normal category.
- Deleting a custom list moves its titles to `Uncategorized` and preserves them in Favorites.
- Empty custom lists persist until the user explicitly deletes them.
- Custom lists are created inside Edit/Save and saving switches Library to the destination list.
- Native and Web implementations remain synchronized for shared UI, library, provider, backup, and list-management behavior.

## Library and backup invariants

The built-in seed currently represents the non-destructive union of the supplied August 4 and August 5 backups:

- 236 provider-aware saved entries.
- 27 named lists.
- Zero seeded history entries.

Seed updates are non-destructive:

- Never overwrite a user's edited entry.
- Never restore a built-in entry the user deleted.
- Add only entries or lists the seed-state system has never seen.
- Preserve version 1 imports containing complete `baseUrl` values.
- Preserve version 2 compact backups containing provider indexes.
- Do not fabricate Continue Watching history on fresh installations.

## Native security boundary

A real-user Microsoft Defender detection overrides a clean CI scan. Treat any user-side detection as a release blocker.

The shipping native executable must not regain the behavior removed after the v0.2.9 incident:

- No native WinHTTP page scraper.
- No custom native image downloader.
- No hidden WebView2 IMDb/TMDB page automation in the shipping binary.
- No interception and saving of remote image response bodies.
- No automatic native artwork-file deletion or pruning implementation.
- No instructions asking users to disable Defender, add exclusions, or bypass a detection.
- No native WebView2 browser-extension loading after the v0.2.16 Defender incident until an independently verified or signed implementation passes the affected user's current signatures.
- No native process-tree or Windows audio-session enumeration/control until an independently verified or signed implementation passes the affected user's current signatures.
- The application must not bundle, download, update, modify, or delete those extension files.

The safe native baseline uses WebView2 normally and stores its profile, HTTP cache, IndexedDB, localStorage, settings, and popup history under `data/` beside the executable. User-supplied artwork under `data/artwork/` may be enumerated and displayed locally, but it must never be downloaded, rewritten, pruned, or deleted by the application.

IMDb/TMDB multi-poster browsing remains open until it can be implemented through an independently verified or signed design that does not trigger endpoint protection. Wikidata, Wikipedia, and Wikimedia Commons remain the bounded metadata/artwork fallbacks.

An unsigned executable may receive an unknown-publisher SmartScreen reputation warning. That is different from an antivirus malware detection. Do not describe an actual detection as merely a reputation warning.

## Development procedure

1. Read the mission ledger and identify every affected invariant.
2. Inspect the current implementation on `main`; do not implement from conversation memory alone.
3. Make the smallest coherent change that solves the request.
4. Update both Native and Web implementations when the behavior is shared.
5. Add or revise static tests for every user-visible or data-format change.
6. Run the native validation/build path and applicable JavaScript tests.
7. Update `missioncache.md` with completed work and carry every unfinished item forward.
8. Bump `VERSION` and the CMake project version together only after the source is ready.
9. Trigger the release by changing `VERSION` last.
10. Inspect the workflow result, logs, packaged assets, security report, and `RELEASE_STATUS.md`.
11. Report success only after the recorded release status is successful.

## Release asset policy

Publish only project-specific artifacts:

- `ShieldedNativeStreamPlayer-v<version>-windows-x64.zip`
- `VidCoreWebPlayer-v<version>.zip`
- `SECURITY_REPORT.txt`
- `SHA256SUMS.txt`

Do not publish a custom source-build ZIP. GitHub automatically adds `Source code (zip)` and `Source code (tar.gz)` to every release, so another source archive is redundant and confuses users.

The native ZIP must contain:

- `VidCoreNativePlayer.exe`
- `assets/`
- `README.md`
- `SECURITY_REPORT.txt`
- empty portable `data/` directory
- `run.bat` that starts from its own directory

Generate checksums only for the project ZIP assets actually uploaded by the workflow.

## Release workflow rules

- Keep the release workflow generic; do not leave stale hardcoded version numbers, title counts, or old release descriptions.
- Build with Visual Studio 2022 on the Windows runner.
- Run validation before packaging.
- Scan the finished executable with Microsoft Defender when the runner scanner is available.
- Include the executable SHA-256, signature state, scan result, source commit, and runner in `SECURITY_REPORT.txt`.
- Delete and recreate an existing tag only when intentionally replacing the same version.
- Package from the exact `RELEASE_TARGET` commit.
- Never claim that the GitHub runner's Defender result guarantees every user's newer local signatures will agree.

## Incident procedure

When a release is reported as blocked or detected:

1. Stop recommending that release immediately.
2. Record the report in `missioncache.md` as a blocker.
3. Identify the behavior added since the last user-downloadable release.
4. Remove or isolate the suspect behavior; do not ask for a security bypass.
5. Publish a new version rather than silently replacing a previously reported binary without clear versioning.
6. Keep the rejected feature open with explicit acceptance criteria for a safe reimplementation.
7. Ask for the exact Defender detection name only when it will materially improve diagnosis; do not delay the safe rollback while waiting for it.

## Repository hygiene

- Do not leave one-time bootstrap workflows, trigger files, staging scripts, temporary branches, or cleanup pull requests after publication.
- Staged updater scripts under `.github/scripts/apply-v*.py` must validate, apply once, be deleted by the workflow, and leave the final source committed.
- Avoid unrelated changes in a release repair.
- Preserve the complete mission history even when an implementation is rolled back.

## Current open constraints

- Authenticode signing or Microsoft Store distribution is still needed for publisher identity and reputation.
- Exact playback position requires provider-supported cross-origin messaging.
- Provider availability and stream quality remain controlled by each provider.
- Browser-hosted code cannot inject popup protection or content filtering into a cross-origin provider iframe.
- Native YouTube filtering is disabled in the security rollback; browser-hosted filtering depends on the user's normal browser extension and current filter behavior.
- Metadata can remain incomplete when no matching Wikidata or English Wikipedia record exists.
- Optional cloud synchronization requires a user-owned backend or account provider.
