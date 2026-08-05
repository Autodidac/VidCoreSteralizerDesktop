from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEW_ENTRIES = json.loads(r"""[
  {
    "mode": "tv",
    "id": "277439",
    "season": 1,
    "episode": 1,
    "title": "Cape Fear",
    "description": "American television series",
    "year": "",
    "image": "https://commons.wikimedia.org/wiki/Special:FilePath/Cape%20Fear%20%28tv%20series%20logo%29.svg",
    "imdb": "tt34675596",
    "tmdb": "277439",
    "genres": [
      "crime television series",
      "drama television series",
      "thriller television series"
    ],
    "genreUris": [
      "http://www.wikidata.org/entity/Q9335577",
      "http://www.wikidata.org/entity/Q1366112",
      "http://www.wikidata.org/entity/Q67175872"
    ],
    "wikidata": "http://www.wikidata.org/entity/Q134126367",
    "article": "https://en.wikipedia.org/wiki/Cape_Fear_(TV_series)",
    "wikipedia": "",
    "resolutionStatus": "resolved",
    "resolvedAt": "2026-08-04T17:43:28.163Z",
    "list": "Crime",
    "notes": "",
    "watched": false,
    "createdAt": "2026-08-04T17:29:54.566Z",
    "updatedAt": "2026-08-04T17:43:28.163Z"
  },
  {
    "mode": "tv",
    "id": "298714",
    "season": 1,
    "episode": 1,
    "title": "TV 298714 · S1 E1",
    "description": "No matching Wikidata metadata was found.",
    "year": "",
    "image": "",
    "imdb": "",
    "tmdb": "298714",
    "genres": [],
    "genreUris": [],
    "wikidata": "",
    "article": "",
    "wikipedia": "",
    "resolutionStatus": "not-found",
    "resolvedAt": "2026-08-04T17:43:27.880Z",
    "list": "Other",
    "notes": "",
    "watched": false,
    "createdAt": "2026-08-04T17:29:04.129Z",
    "updatedAt": "2026-08-04T17:43:27.925Z"
  },
  {
    "mode": "tv",
    "id": "319179",
    "season": 1,
    "episode": 1,
    "title": "TV 319179 · S1 E1",
    "description": "No matching Wikidata metadata was found.",
    "year": "",
    "image": "",
    "imdb": "",
    "tmdb": "319179",
    "genres": [],
    "genreUris": [],
    "wikidata": "",
    "article": "",
    "wikipedia": "",
    "resolutionStatus": "not-found",
    "resolvedAt": "2026-08-04T17:51:21.995Z",
    "list": "Documentary",
    "notes": "",
    "watched": false,
    "createdAt": "2026-08-04T17:51:13.657Z",
    "updatedAt": "2026-08-04T17:51:22.089Z",
    "provider": 1
  }
]""")
NEW_EXPORTED_AT = "2026-08-05T06:57:40.704Z"


def require_replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def update_additions(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"  const additions = (\[.*?\]);\n\n  const listAdditions",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Could not locate additions array in {path}")

    additions = json.loads(match.group(1))

    def identity(entry: dict) -> tuple[str, str, object, object]:
        mode = str(entry.get("mode", ""))
        return (
            mode,
            str(entry.get("id", "")),
            entry.get("season", 1) if mode == "tv" else "",
            entry.get("episode", 1) if mode == "tv" else "",
        )

    known = {identity(entry) for entry in additions}
    for entry in NEW_ENTRIES:
        key = identity(entry)
        if key not in known:
            known.add(key)
            additions.append(entry)

    encoded = json.dumps(additions, indent=2, ensure_ascii=False)
    lines = encoded.splitlines()
    rendered = "  const additions = " + lines[0] + "\n"
    rendered += "\n".join("  " + line for line in lines[1:]) + ";"

    text = text[: match.start()] + rendered + "\n\n  const listAdditions" + text[match.end():]
    text = re.sub(
        r'exportedAt: "[^"]+"',
        f'exportedAt: "{NEW_EXPORTED_AT}"',
        text,
        count=1,
    )
    path.write_text(text, encoding="utf-8")


for relative in [
    "VidCoreNativePlayer/assets/builtin-additions.js",
    "VidCoreWebPlayer/builtin-additions.js",
]:
    update_additions(ROOT / relative)

native = (ROOT / "VidCoreNativePlayer/assets/builtin-additions.js").read_text(encoding="utf-8")
web = (ROOT / "VidCoreWebPlayer/builtin-additions.js").read_text(encoding="utf-8")
if native != web:
    raise RuntimeError("Native and Web additions files diverged.")

for relative in [
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    "VidCoreNativePlayer/tests/builtin-library.test.mjs",
]:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    old = '  "The Sandman"\n])'
    new = (
        '  "The Sandman",\n'
        '  "Cape Fear",\n'
        '  "TV 298714 · S1 E1",\n'
        '  "TV 319179 · S1 E1"\n'
        '])'
    )
    if old not in text:
        raise RuntimeError(f"Expected title list not found in {path}")
    text = text.replace(old, new)
    if relative.endswith("builtin-library.test.mjs"):
        text = text.replace(
            "assert.equal(library.favorites.length, 111);",
            "assert.equal(library.favorites.length, 114);",
        )
    path.write_text(text, encoding="utf-8")

require_replace(
    ROOT / "VidCoreNativePlayer/CMakeLists.txt",
    "VERSION 0.2.11",
    "VERSION 0.2.12",
)

agents = ROOT / "AGENTS.md"
agents_text = agents.read_text(encoding="utf-8")
agents_text = agents_text.replace(
    "The built-in seed currently represents the union of the supplied August 4 backups:",
    "The built-in seed currently represents the non-destructive union of the supplied August 4 and August 5 backups:",
)
agents_text = agents_text.replace(
    "- 111 provider-aware saved entries.",
    "- 114 provider-aware saved entries.",
)
agents.write_text(agents_text, encoding="utf-8")

workflow = ROOT / ".github/workflows/release.yml"
workflow_text = workflow.read_text(encoding="utf-8")
workflow_text = workflow_text.replace(
    'throw "VERSION must contain a semantic version such as 0.2.11."',
    'throw "VERSION must contain a semantic version such as 1.2.3."',
)
workflow_text = workflow_text.replace(
    "111 provider-aware built-in entries across 25 lists",
    "114 provider-aware built-in entries across 25 lists",
)
workflow.write_text(workflow_text, encoding="utf-8")

mission = ROOT / "missioncache.md"
mission_text = mission.read_text(encoding="utf-8")
completed_anchor = (
    "- [x] Confirm no open pull requests remain after the v0.2.11 release.\n"
)
completed_insert = (
    completed_anchor
    + "- [x] Compare the August 5 native backup against the complete built-in identity union instead of replacing prior defaults.\n"
    + "- [x] Add the three genuinely unseen TV defaults: Cape Fear (TMDB 277439), TMDB 298714 S1E1, and TMDB 319179 S1E1.\n"
    + "- [x] Preserve Reacher, The Sandman, The Gentleman Thief, all prior defaults, all 25 lists, and zero seeded history while expanding the built-in library to 114 entries.\n"
)
if completed_anchor not in mission_text:
    raise RuntimeError("Mission cache completion anchor not found.")
mission_text = mission_text.replace(completed_anchor, completed_insert)
open_anchor = "## Open / provider-limited\n\n"
mission_text = mission_text.replace(
    open_anchor,
    open_anchor
    + "- [ ] Publish v0.2.12 with the 114-entry non-destructive August 4/5 default union.\n"
    + "- [ ] Verify the downloadable v0.2.12 Windows artifact against the affected user's current local Microsoft Defender signatures.\n",
)
mission_text = mission_text.replace(
    "- [ ] Verify the downloadable v0.2.11 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.\n",
    "",
)
mission.write_text(mission_text, encoding="utf-8")
