from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEW_EXPORTED_AT = "2026-08-05T06:57:40.704Z"
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


def identity(entry: dict) -> tuple[str, str, object, object]:
    mode = str(entry.get("mode", ""))
    return (
        mode,
        str(entry.get("id", "")),
        entry.get("season", 1) if mode == "tv" else "",
        entry.get("episode", 1) if mode == "tv" else "",
    )


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Expected {label} text was not found: {old!r}")
    return text.replace(old, new)


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
    known = {identity(entry) for entry in additions}
    for entry in NEW_ENTRIES:
        key = identity(entry)
        if key not in known:
            known.add(key)
            additions.append(entry)

    encoded = json.dumps(additions, indent=2, ensure_ascii=False)
    rendered = "\n".join("  " + line for line in encoded.splitlines())
    replacement = f"  const additions = {rendered.lstrip()};\n\n  const listAdditions"
    text = text[: match.start()] + replacement + text[match.end():]
    text, count = re.subn(
        r'exportedAt: "[^"]+"',
        f'exportedAt: "{NEW_EXPORTED_AT}"',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"Could not update exportedAt in {path}")
    path.write_text(text, encoding="utf-8")


def update_test(path: Path, update_count: bool) -> None:
    text = path.read_text(encoding="utf-8")
    if '"Cape Fear"' not in text:
        pattern = re.compile(r'(?m)^(?P<indent>\s*)"The Sandman"(?P<comma>,?)$')
        match = pattern.search(text)
        if not match:
            raise RuntimeError(f"The Sandman assertion line was not found in {path}")
        indent = match.group("indent")
        replacement = (
            f'{indent}"The Sandman",\n'
            f'{indent}"Cape Fear",\n'
            f'{indent}"TV 298714 · S1 E1",\n'
            f'{indent}"TV 319179 · S1 E1"'
        )
        text = text[: match.start()] + replacement + text[match.end():]

    if update_count:
        if "assert.equal(library.favorites.length, 111);" in text:
            text = text.replace(
                "assert.equal(library.favorites.length, 111);",
                "assert.equal(library.favorites.length, 114);",
            )
        elif "assert.equal(library.favorites.length, 114);" not in text:
            raise RuntimeError(f"Built-in count assertion was not found in {path}")

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

update_test(ROOT / "VidCoreNativePlayer/tests/static-smoke.test.mjs", False)
update_test(ROOT / "VidCoreNativePlayer/tests/builtin-library.test.mjs", True)

cmake = ROOT / "VidCoreNativePlayer/CMakeLists.txt"
cmake_text = cmake.read_text(encoding="utf-8")
if "VERSION 0.2.11" in cmake_text:
    cmake_text = cmake_text.replace("VERSION 0.2.11", "VERSION 0.2.12")
elif "VERSION 0.2.12" not in cmake_text:
    raise RuntimeError("Unexpected CMake version.")
cmake.write_text(cmake_text, encoding="utf-8")

# Normalize the whitespace-only release trigger once the staged source is applied.
(ROOT / "VERSION").write_text("0.2.12\n", encoding="utf-8")

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
completed_lines = [
    "- [x] Compare the August 5 native backup against the complete built-in identity union instead of replacing prior defaults.",
    "- [x] Add the three genuinely unseen TV defaults: Cape Fear (TMDB 277439), TMDB 298714 S1E1, and TMDB 319179 S1E1.",
    "- [x] Preserve Reacher, The Sandman, The Gentleman Thief, all prior defaults, all 25 lists, and zero seeded history while expanding the built-in library to 114 entries.",
    "- [x] Correct the first v0.2.12 updater failure caused by an over-specific test-file pattern without dropping the release mission.",
]
anchor = "- [x] Confirm no open pull requests remain after the v0.2.11 release."
if completed_lines[0] not in mission_text:
    if anchor not in mission_text:
        raise RuntimeError("Mission cache completion anchor not found.")
    mission_text = mission_text.replace(
        anchor,
        anchor + "\n" + "\n".join(completed_lines),
    )

open_anchor = "## Open / provider-limited\n\n"
open_lines = [
    "- [ ] Publish v0.2.12 with the 114-entry non-destructive August 4/5 default union.",
    "- [ ] Verify the downloadable v0.2.12 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.",
]
if open_lines[0] not in mission_text:
    if open_anchor not in mission_text:
        raise RuntimeError("Mission cache open-section anchor not found.")
    mission_text = mission_text.replace(open_anchor, open_anchor + "\n".join(open_lines) + "\n")
mission_text = mission_text.replace(
    "- [ ] Verify the downloadable v0.2.11 Windows artifact against the affected user's current local Microsoft Defender signatures; the GitHub runner cannot reproduce every endpoint signature state.\n",
    "",
)
mission.write_text(mission_text, encoding="utf-8")
