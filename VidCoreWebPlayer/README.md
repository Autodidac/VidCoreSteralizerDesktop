# VidCore Web Player

The browser version of the VidCore player. It shares the enhanced metadata, scanner, library, Favorites, Continue Watching, Recommended, Related, edit/delete dialog, and JSON backup features with the native project.

It also includes YouTube URL/ID playback and oEmbed metadata, active-list Previous/Next navigation, persistent provider volume, editable display titles, and provider-aware next-in-series metadata. Its built-in library contains the 236-entry, 27-list import.json union with no seeded history.

## Run

```bat
run.bat
```

Then open `http://localhost:8080/`.

## Popup limitation

The web shell can block its own popup attempts, but a normal web page cannot inject scripts into a cross-origin provider iframe. Install a browser blocker such as uBlock Origin in the browser running this page when you want filtering inside provider or YouTube frames. The C++ desktop version adds native WebView2 interception and can load a user-supplied unpacked extension from its portable data folder.


## v0.2.2

- Provider order: VidCore, YTHD, VidUp.
- Pause is directly beside Play.
- Saved cards retain their own provider while the main Play uses the currently selected provider.
- New JSON backups use compact provider-indexed backups and still import the version 1 full-URL format.

- v0.2.4 places playback/resolve controls below transport and includes a non-destructive built-in starter library.
