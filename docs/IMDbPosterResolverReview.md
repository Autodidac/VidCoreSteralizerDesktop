# IMDbPosterResolver C++23 review

The supplied standalone resolver was reviewed for v0.2.15. Its strongest reusable idea is identity-first poster selection: anchor on IMDb's rendered hero-poster media key, collect JSON-LD and rendered-image candidates, reject candidates with a different media identity, then prefer the largest exact variant.

The sample also contains hidden WebView2 page automation and a custom WinHTTP image downloader. Those parts are intentionally not linked into or invoked by the shipping player because they recreate the network behavior removed after the real-user Microsoft Defender detection. The shipping executable remains on the v0.2.10+ Defender-safe profile.

A future IMDb/TMDB multi-poster implementation must remain independently verified or signed, preserve explicit user control, and pass both CI and affected-user endpoint checks before release.
