"use strict";

(() => {
  const metadata = globalThis.VidCoreMetadata;
  if (!metadata) {
    throw new Error("VidCoreMetadata must load before providers.js.");
  }

  const providers = Object.freeze([
    Object.freeze({ id: "vidcore", label: "VidCore", baseUrl: "https://vidcore.net" }),
    Object.freeze({ id: "ythd", label: "YTHD", baseUrl: "https://ythd.org/embed" }),
    Object.freeze({ id: "vidup", label: "VidUp", baseUrl: "https://vidup.to" }),
    Object.freeze({ id: "youtube", label: "YouTube", baseUrl: "https://www.youtube.com" })
  ]);
  const NATIVE_YOUTUBE_ORIGIN = "https://player.vidcore.test";
  const YOUTUBE_WRAPPER = "youtube-player.html";

  function providerFor(value) {
    const normalized = metadata.normalizeBaseUrl(value);
    return providers.find(provider => provider.baseUrl === normalized) || providers[0];
  }

  function buildPlayerUrl(entry, autoplay = true) {
    const normalized = metadata.normalizeEntry(entry);
    const provider = providerFor(normalized.baseUrl);
    let path;
    let url;

    if (normalized.mode === "youtube" || provider.id === "youtube") {
      const native = Boolean(globalThis.chrome?.webview);
      url = native
        ? new URL(YOUTUBE_WRAPPER, `${NATIVE_YOUTUBE_ORIGIN}/`)
        : new URL(YOUTUBE_WRAPPER, location.href);
      url.searchParams.set("video", normalized.id);
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      return url.href;
    }

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

  function playerFrame() {
    return document.querySelector("#player");
  }

  function youtubeCommand(action, args = []) {
    if (document.querySelector("#mode")?.value !== "youtube") return false;
    const target = globalThis.chrome?.webview
      ? NATIVE_YOUTUBE_ORIGIN
      : location.origin;
    playerFrame()?.contentWindow?.postMessage(
      {
        type: "VIDCORE_YOUTUBE_COMMAND",
        action,
        args
      },
      target
    );
    return true;
  }

  function providerCommand(action, value = undefined) {
    playerFrame()?.contentWindow?.postMessage(
      {
        type: "VIDCORE_PLAYER_COMMAND",
        action,
        ...(value === undefined ? {} : { value })
      },
      "*"
    );
  }

  function requestPause() {
    if (!youtubeCommand("pauseVideo")) providerCommand("pause");

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

  function requestMute(muted) {
    if (!youtubeCommand(muted ? "mute" : "unMute")) {
      providerCommand("mute", Boolean(muted));
    }
  }

  function requestVolume(value) {
    const volume = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (!youtubeCommand("setVolume", [volume])) {
      providerCommand("volume", volume);
    }
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
    requestPause,
    requestMute,
    requestVolume
  });
})();
