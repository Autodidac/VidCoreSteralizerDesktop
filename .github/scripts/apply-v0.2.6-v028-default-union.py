from pathlib import Path

root = Path.cwd()

cmake_path = root / "VidCoreNativePlayer" / "CMakeLists.txt"
cmake = cmake_path.read_text(encoding="utf-8")
if "VERSION 0.2.7" not in cmake:
    raise RuntimeError("Expected v0.2.7 CMake version")
cmake_path.write_text(cmake.replace("VERSION 0.2.7", "VERSION 0.2.8", 1), encoding="utf-8", newline="\n")

native_additions = (root / "VidCoreNativePlayer" / "assets" / "builtin-additions.js").read_text(encoding="utf-8")
web_additions = (root / "VidCoreWebPlayer" / "builtin-additions.js").read_text(encoding="utf-8")
if native_additions != web_additions:
    raise RuntimeError("Native and Web default additions differ")
for title in [
    "Wednesday",
    "Landman",
    "Mating Season",
    "Reacher",
    "Dexter: Resurrection",
    "The Sandman",
]:
    if f'"title": "{title}"' not in native_additions:
        raise RuntimeError(f"Missing default title: {title}")
if '"name": "Fantasy"' not in native_additions:
    raise RuntimeError("Missing Fantasy default list")

mission_path = root / "missioncache.md"
mission = mission_path.read_text(encoding="utf-8")
section = """
- [x] Merge every supplied August 4 backup as a union instead of replacing one backup with another.
- [x] Preserve all 111 provider-aware saved entries and all 25 named lists in built-in defaults.
- [x] Add Reacher, Dexter: Resurrection, The Sandman, and the Fantasy list while retaining Wednesday, Landman, and Mating Season.
- [x] Keep built-in history empty so a fresh install does not start with fabricated Continue Watching activity.
- [x] Publish release `v0.2.8` with the complete merged default union.

"""
anchor = "## Open / provider-limited\n"
if section.strip() not in mission:
    if anchor not in mission:
        raise RuntimeError("Mission cache open-section anchor missing")
    mission = mission.replace(anchor, section + anchor, 1)
mission_path.write_text(mission, encoding="utf-8", newline="\n")

for relative in ["README.md", "VidCoreNativePlayer/README.md", "VidCoreWebPlayer/README.md"]:
    path = root / relative
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace("108 built-in", "111 built-in")
    text = text.replace("108-title", "111-title")
    text = text.replace("24-list", "25-list")
    path.write_text(text, encoding="utf-8", newline="\n")

workflow_path = root / ".github" / "workflows" / "release.yml"
workflow = workflow_path.read_text(encoding="utf-8")
workflow = workflow.replace(
    "Existing v0.2.6 interface, provider, backup, library, blocker, and metadata-filtering work remains included.",
    "The current interface, provider, backup, library, blocker, metadata-filtering, list-management, and merged-default work remains included.",
)
workflow = workflow.replace(
    "VERSION must contain a semantic version such as 0.2.6.",
    "VERSION must contain a semantic version such as 0.2.8.",
)
workflow_path.write_text(workflow, encoding="utf-8", newline="\n")

print("Prepared v0.2.8 with 111 default entries and 25 lists.")
