import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const repositoryRoot = path.resolve(root, "..");
const code = fs.readFileSync(path.join(root, "assets", "providers.js"), "utf8");
const context = {
  URL,
  document: {
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; }
  },
  VidCoreMetadata: {
    normalizeBaseUrl(value) {
      const parsed = new URL(String(value).trim());
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    },
    normalizeEntry(entry) {
      return {
        baseUrl: this.normalizeBaseUrl(entry.baseUrl),
        mode: entry.mode === "tv" ? "tv" : "movie",
        id: String(entry.id),
        season: Number(entry.season || 1),
        episode: Number(entry.episode || 1)
      };
    }
  }
};
vm.createContext(context);
vm.runInContext(code, context);
assert.deepEqual(
  [...context.VidCoreProviders.providers].map(provider => provider.label),
  ["VidCore", "YTHD", "VidUp"]
);
const build = context.VidCoreMetadata.buildPlayerUrl;
assert.equal(build({ baseUrl: "https://vidcore.net", mode: "movie", id: "27205" }), "https://vidcore.net/movie/27205?autoPlay=true&title=true&poster=true&fullscreenButton=true");
assert.equal(build({ baseUrl: "https://ythd.org/embed", mode: "movie", id: "tt0466342" }), "https://ythd.org/embed/tt0466342");
assert.equal(build({ baseUrl: "https://ythd.org/embed", mode: "tv", id: "1396", season: 2, episode: 3 }), "https://ythd.org/embed/1396/2/3");
assert.equal(build({ baseUrl: "https://vidup.to", mode: "tv", id: "1396", season: 2, episode: 3 }), "https://vidup.to/tv/1396/2/3?autoPlay=true&title=true&poster=true&fullscreenButton=true");
for (const htmlPath of [
  path.join(root, "assets", "index.html"),
  path.join(repositoryRoot, "VidCoreWebPlayer", "index.html")
]) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const a = html.indexOf('>VidCore</option>');
  const b = html.indexOf('>YTHD</option>');
  const c = html.indexOf('>VidUp</option>');
  assert.ok(a >= 0 && a < b && b < c);
  assert.match(html, /id="playButton"[^>]*>Play<\/button>\s*<button id="pauseButton"[^>]*>Pause<\/button>/);
  assert.ok(html.indexOf('src="metadata.js"') < html.indexOf('src="providers.js"'));
}
const webview = fs.readFileSync(path.join(root, "src", "vidcore.webview.ixx"), "utf8");
assert.match(webview, /VIDCORE_PLAYER_COMMAND/);
assert.match(webview, /media\.pause\(\)/);
console.log("Provider routing and pause-control checks passed.");
