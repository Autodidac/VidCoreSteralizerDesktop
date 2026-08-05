# VidCore Steralizer Desktop

Two maintained VidCore players live in separate folders:

- [`VidCoreNativePlayer/`](VidCoreNativePlayer/) — C++23 modules, Win32, and WebView2 with native popup/new-window interception.
- [`VidCoreWebPlayer/`](VidCoreWebPlayer/) — standalone browser version with the same metadata, discovery, and library workflow.

## Current development work

- The supplied import.json is now the deterministic built-in source: 236 provider-aware entries across 27 lists, with zero seeded history.
- YouTube is a distinct fourth playback mode with URL/ID normalization, official embed playback, and oEmbed metadata.
- Previous and Next move through the selected and filtered Library list, with wraparound.
- Edit/Save stores a manual title and an optional provider-aware next-in-series link.
- A persistent volume slider requests provider-supported playback volume; native Windows audio-session control is disabled in the security rollback.
- Native WebView2 extension loading is disabled after the v0.2.16 Defender detection; the browser build can still use extensions installed normally in the user's browser.
- Native and Web shared assets have regression checks that fail when the copies drift.

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

