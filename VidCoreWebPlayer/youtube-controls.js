"use strict";

(() => {
  const frame = document.querySelector("#player");
  const mode = document.querySelector("#mode");
  const row = document.querySelector("#youtubeSeekRow");
  const slider = document.querySelector("#youtubeSeekSlider");
  const output = document.querySelector("#youtubeSeekOutput");
  const stop = document.querySelector("#stopButton");
  const fallbackOpened = new Set();
  if (!frame || !mode || !row || !slider || !output) return;

  let duration = 0;
  let dragging = false;

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = String(seconds % 60).padStart(2, "0");
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
      : `${minutes}:${remainder}`;
  }

  function reset() {
    duration = 0;
    slider.value = "0";
    slider.disabled = true;
    output.textContent = "0:00 / 0:00";
  }

  function updateVisibility() {
    const youtube = mode.value === "youtube";
    row.classList.toggle("hidden", !youtube);
    if (!youtube) reset();
  }

  function post(action, args = []) {
    if (mode.value !== "youtube") return;
    const target = globalThis.chrome?.webview
      ? "https://player.vidcore.test"
      : location.origin;
    frame.contentWindow?.postMessage({
      type: "VIDCORE_YOUTUBE_COMMAND",
      action,
      args
    }, target);
  }

  function external(url) {
    if (globalThis.chrome?.webview) {
      globalThis.chrome.webview.postMessage(`open-external|${url}`);
    } else {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function announce(title, text, type = "warn") {
    const heading = document.querySelector("#statusTitle");
    const body = document.querySelector("#statusText");
    const panel = document.querySelector("#statusPanel");
    if (heading) heading.textContent = title;
    if (body) body.textContent = text;
    if (panel) panel.dataset.type = type;
  }

  addEventListener("message", event => {
    if (event.source !== frame.contentWindow || !event.data) return;
    const expected = globalThis.chrome?.webview
      ? "https://player.vidcore.test"
      : location.origin;
    if (event.origin !== expected) return;

    if (event.data.type === "VIDCORE_YOUTUBE_STATE") {
      duration = Math.max(0, Number(event.data.duration) || 0);
      const current = Math.max(0, Number(event.data.currentTime) || 0);
      slider.disabled = duration <= 0;
      slider.dataset.currentTime = String(current);
      if (!dragging && duration > 0) {
        slider.value = String(Math.round((current / duration) * 1000));
      }
      const shown = dragging && duration > 0
        ? duration * (Number(slider.value) / 1000)
        : current;
      output.textContent = `${formatTime(shown)} / ${formatTime(duration)}`;
      return;
    }

    if (event.data.type === "VIDCORE_YOUTUBE_ERROR") {
      const code = Number(event.data.code) || 0;
      const watchUrl = String(event.data.watchUrl || "");
      announce(
        `YouTube playback error ${code}`,
        event.data.fallback
          ? "Opening the full YouTube watch page in your browser."
          : "Use Watch on YouTube if embedded playback is unavailable."
      );
      if (event.data.fallback && watchUrl && !fallbackOpened.has(watchUrl)) {
        fallbackOpened.add(watchUrl);
        external(watchUrl);
      }
    }
  });

  slider.addEventListener("pointerdown", () => { dragging = true; });
  slider.addEventListener("input", () => {
    if (duration > 0) {
      output.textContent = `${formatTime(duration * (Number(slider.value) / 1000))} / ${formatTime(duration)}`;
    }
  });
  slider.addEventListener("change", () => {
    dragging = false;
    post("seekFraction", [Number(slider.value) / 1000]);
  });
  slider.addEventListener("pointerup", () => { dragging = false; });
  mode.addEventListener("change", updateVisibility);
  stop?.addEventListener("click", reset);
  updateVisibility();
})();
