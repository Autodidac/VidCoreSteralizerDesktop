"use strict";

(() => {
  const metadata = globalThis.VidCoreMetadata;
  if (!metadata) {
    throw new Error("VidCoreMetadata must load before providers.js.");
  }

  const providers = Object.freeze([
    Object.freeze({ id: "vidcore", label: "VidCore", baseUrl: "https://vidcore.net" }),
    Object.freeze({ id: "ythd", label: "YTHD", baseUrl: "https://ythd.org/embed" }),
    Object.freeze({ id: "vidup", label: "VidUp", baseUrl: "https://vidup.to" })
  ]);

  function providerFor(value) {
    const normalized = metadata.normalizeBaseUrl(value);
    return providers.find(provider => provider.baseUrl === normalized) || providers[0];
  }

  function buildPlayerUrl(entry, autoplay = true) {
    const normalized = metadata.normalizeEntry(entry);
    const provider = providerFor(normalized.baseUrl);
    let path;
    let url;

    if (provider.id === "ythd") {
      path = normalized.mode === "movie"
        ? `/${encodeURIComponent(normalized.id)}`
        : `/${encodeURIComponent(normalized.id)}/${normalized.season}/${normalized.episode}`;
      return new URL(provider.baseUrl + path).href;
    }

    path = normalized.mode === "movie"
      ? `/movie/${encodeURIComponent(normalized.id)}`
      : `/tv/${encodeURIComponent(normalized.id)}/${normalized.season}/${normalized.episode}`;
    url = new URL(provider.baseUrl + path);
    url.searchParams.set("autoPlay", autoplay ? "true" : "false");
    url.searchParams.set("title", "true");
    url.searchParams.set("poster", "true");
    url.searchParams.set("fullscreenButton", "true");
    return url.href;
  }

  globalThis.VidCoreMetadata = Object.freeze({ ...metadata, buildPlayerUrl });

  function requestPause() {
    document.querySelector("#player")?.contentWindow?.postMessage(
      { type: "VIDCORE_PLAYER_COMMAND", action: "pause" },
      "*"
    );

    const title = document.querySelector("#statusTitle");
    const text = document.querySelector("#statusText");
    const panel = document.querySelector("#statusPanel");
    if (title) title.textContent = "Pause requested";
    if (text) {
      text.textContent = globalThis.chrome?.webview
        ? "The native player sent pause through the active provider frame."
        : "Pause was sent to the provider; browser-only support depends on that provider.";
    }
    if (panel) panel.dataset.type = "ok";
  }

  function wirePauseButton() {
    document.querySelector("#pauseButton")?.addEventListener("click", requestPause);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wirePauseButton, { once: true });
  } else {
    wirePauseButton();
  }

  globalThis.VidCoreProviders = Object.freeze({
    providers,
    providerFor,
    buildPlayerUrl,
    requestPause
  });
})();
