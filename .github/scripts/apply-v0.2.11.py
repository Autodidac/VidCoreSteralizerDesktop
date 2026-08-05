from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

cmake_path = ROOT / "VidCoreNativePlayer" / "CMakeLists.txt"
cmake = cmake_path.read_text(encoding="utf-8")
old_version = "VERSION 0.2.10"
new_version = "VERSION 0.2.11"
if old_version not in cmake:
    raise SystemExit(f"Expected {old_version!r} in {cmake_path}")
cmake_path.write_text(cmake.replace(old_version, new_version, 1), encoding="utf-8")

mission_path = ROOT / "missioncache.md"
mission = mission_path.read_text(encoding="utf-8")

old_verify = (
    "- [ ] Publish v0.2.10 and verify the downloadable Windows artifact "
    "no longer triggers the reported Defender detection."
)
new_verify = (
    "- [ ] Verify the downloadable v0.2.11 Windows artifact against current "
    "local Microsoft Defender signatures; the CI scan is not sufficient proof "
    "for every endpoint."
)
if old_verify in mission:
    mission = mission.replace(old_verify, new_verify, 1)

completed = """
- [x] Add a root `AGENTS.md` with durable product invariants, security boundaries, development procedure, release procedure, incident handling, and repository hygiene.
- [x] Remove the redundant custom native source-build ZIP from release packaging and rely on GitHub's automatic source ZIP and TAR.GZ archives.
- [x] Generalize release notes and asset packaging so they describe the current 111-entry, 25-list, zero-history state without stale version-specific claims.
""".strip()

publish_open = (
    "- [ ] Publish v0.2.11 with only the native Windows ZIP, Web-player ZIP, "
    "security report, and checksum manifest as custom release assets."
)

if completed not in mission:
    marker = "\n## Open / provider-limited\n"
    if marker not in mission:
        raise SystemExit("Open mission section marker not found")
    mission = mission.replace(marker, f"\n\n{completed}\n{marker}", 1)

if publish_open not in mission:
    marker = "## Open / provider-limited\n"
    mission = mission.replace(marker, f"{marker}\n{publish_open}\n", 1)

mission_path.write_text(mission, encoding="utf-8")
