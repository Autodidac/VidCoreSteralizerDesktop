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
