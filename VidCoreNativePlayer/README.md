# VidCore Native Player v0.2.1

A standalone Windows C++23 module project that hosts configurable streaming pages in Microsoft Edge WebView2.

This repository contains the complete desktop player at its root.


## v0.2.1 library and metadata corrections

- Database pick is the default Random mode.
- Favorites is permanent immediately after All and also has a dedicated sidebar tab.
- Delete was removed from media cards and moved into the Edit dialog.
- Artwork repair now uses direct Wikidata entity claims/sitelinks, exact Wikipedia pages, and scored Wikipedia search fallback.
- Related titles with missing artwork are repaired with bounded concurrency.

## Restored feature set

### Playback and navigation

- Configurable HTTPS provider URL
- Movie IDs using numeric TMDB or IMDb `tt…` identifiers
- TV IDs with season and episode
- Play, Stop, Mute, Theater, Fullscreen, Copy URL, UI zoom, and DevTools
- Metadata-first Previous and Next scanning
- Random numeric discovery
- Random public-database discovery
- Scanner cancellation by pressing Previous, Next, or Random again

### Metadata and discovery

- Wikidata title, description, year, cover image, IMDb ID, TMDB ID, and genres
- English Wikipedia fallback for missing names, descriptions, and artwork
- Related movie or TV suggestions based on resolved genres
- Official IMDb, TMDB, and Wikipedia links opened through the native host
- Rolling Recommended queue containing the newest 40 resolved titles with artwork
- Metadata repair for an entire selected list
- Throttled sequential discovery instead of repeatedly loading unresolved provider pages

### Library

- IndexedDB storage with automatic localStorage fallback
- Named lists with item counts
- Notes
- Watched state
- Library filtering
- Continue Watching based on played titles and manual completion
- JSON import and export
- Migration from the v0.1.x native favorites/recent keys when the WebView2 storage origin is retained

Exact playback position cannot be read from the cross-origin provider frame unless the provider exposes a supported messaging API. Continue Watching therefore tracks played titles and manual completion rather than pretending to know the seek position.

## Native popup shield

The popup shield remains outside the provider page:

1. WebView2 `NewWindowRequested` events are marked handled.
2. Top-level navigation away from the local application shell is canceled.
3. A document-created script is injected into the shell and every child frame before page scripts run.
4. The injected guard blocks:
   - `window.open`
   - `_blank` navigation
   - external click redirects
   - middle-click navigation
   - external form navigation
5. Blocked hosts are learned into:

```text
%LOCALAPPDATA%\VidCoreNativePlayer\blocked-hosts.txt
```

This blocks popup windows and page hijacks. It does not guarantee removal of every visual advertisement rendered inside the embedded provider frame.

## Requirements

- Windows 10 or Windows 11 x64
- Visual Studio 2022 with **Desktop development with C++**
- CMake 3.28 or newer
- Microsoft Edge WebView2 Runtime
- Node.js is optional and only used by `validate.bat`

The build bootstrap downloads the pinned Microsoft WebView2 SDK package:

```text
Microsoft.Web.WebView2 1.0.4078.44
```

## Build and run

```bat
clean.bat
run.bat
```

`run.bat` builds automatically when the Release executable does not exist.

Executable:

```text
build\Release\VidCoreNativePlayer.exe
```

## Validation

```bat
validate.bat
```

This checks every JavaScript file and runs static feature/shield smoke tests. When Node.js is unavailable, validation is skipped without blocking the C++ build.

## Keyboard shortcuts

- `[` — previous resolved numeric ID
- `]` — next resolved numeric ID
- `R` — random discovery
- `T` — theater mode
- `M` — mute
- `Esc` — leave theater or fullscreen

Use the player only with sources and media you are authorized to access.


## v0.2.2

- Provider order: VidCore, YTHD, VidUp.
- Pause is directly beside Play.
- Saved cards retain their own provider while the main Play uses the currently selected provider.
- New JSON backups use compact provider-indexed backups and still import the version 1 full-URL format.

- v0.2.4 places playback/resolve controls below transport and includes a non-destructive built-in starter library.


## Portable data and image cache

The Windows build keeps its complete WebView2 profile in `data/` beside `VidCoreNativePlayer.exe`. That folder contains browser cache, resolved remote artwork cache, IndexedDB, localStorage, popup-block history, and other runtime state. Moving the application folder moves its data with it; the player no longer creates its own application folder under Local AppData.

Artwork resolution rejects diagrams, unrelated subject images, actor/director portraits, cast photos, and red-carpet images. It prefers film-poster, logo, and film-still properties tied to the exact Wikidata title, then uses strict Wikipedia and Wikimedia Commons fallbacks.


## Portable browser data

The native executable does not contain a custom page scraper, native image downloader, or automatic image-file deletion code. WebView2 keeps its browser profile, HTTP cache, IndexedDB, localStorage, settings, and popup history under `data/` beside the executable. This keeps all runtime data portable without adding downloader behavior to the unsigned EXE.


## v0.2.9 IMDb and TMDB artwork gallery

- Metadata names and identifiers remain resolved through the existing metadata system.
- The native player opens the title pages in a hidden WebView2 browser, reads poster `<img>` elements, and chooses the smallest usable `srcset` candidate.
- IMDb primary and media-index posters and TMDB primary and poster-gallery images can be flipped through from the current metadata card.
- The first IMDb poster is preferred, with TMDB used when IMDb does not provide a usable image.
- Selected images are captured from WebView2 responses and written under `cache/` beside the executable. The native host does not use WinHTTP or a custom HTTP client.
- Cached variants are reused by media identity, removed when the final saved entry is deleted, and pruned when no saved media references them.
