from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SAFE_SOURCE = "4a857f1e7d58002e49c7abcc4599d1087d88b586"

RESTORE = [
    "VidCoreNativePlayer/assets/app.js",
    "VidCoreNativePlayer/assets/index.html",
    "VidCoreNativePlayer/src/vidcore.webview.ixx",
    "VidCoreNativePlayer/tests/static-smoke.test.mjs",
    "VidCoreWebPlayer/app.js",
    "VidCoreWebPlayer/index.html",
]


def git_show(path: str) -> bytes:
    return subprocess.check_output(
        ["git", "show", f"{SAFE_SOURCE}:{path}"],
        cwd=ROOT,
    )


for relative in RESTORE:
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(git_show(relative))

cmake_path = ROOT / "VidCoreNativePlayer/CMakeLists.txt"
cmake = git_show("VidCoreNativePlayer/CMakeLists.txt").decode("utf-8")
cmake = cmake.replace("VERSION 0.2.8", "VERSION 0.2.10", 1)
cmake_path.write_text(cmake, encoding="utf-8")

resolver = ROOT / "VidCoreNativePlayer/src/vidcore.artwork_resolver.ixx"
resolver.unlink(missing_ok=True)

readme_path = ROOT / "VidCoreNativePlayer/README.md"
readme = git_show("VidCoreNativePlayer/README.md").decode("utf-8").rstrip()
readme += """


## v0.2.10 Defender-safe rollback

- The v0.2.9 hidden IMDb/TMDB WebView2 artwork resolver and response-to-file cache were removed after a real-user Microsoft Defender detection.
- The shipping executable is restored to the v0.2.8 native network profile: no hidden catalog browser, image-response capture, custom artwork downloader, or automatic artwork-file lifecycle.
- The compact blue layout, merged defaults, provider routing, list deletion, and portable WebView2 profile remain intact.
- IMDb/TMDB poster-gallery work remains in the mission cache until it can be delivered without endpoint-protection detections.
"""
readme_path.write_text(readme + "\n", encoding="utf-8")

mission_path = ROOT / "missioncache.md"
mission = mission_path.read_text(encoding="utf-8")
completed_block = re.compile(
    r"\n\n- \[x\] Resolve IMDb title and media-index poster images through a hidden WebView2 browser instead of a native HTTP scraper\.[\s\S]*?- \[x\] Publish release `v0\.2\.9` with the IMDb/TMDB artwork gallery and portable cache\.\n",
    re.MULTILINE,
)
mission = completed_block.sub("\n", mission)
completed_anchor = "## Open / provider-limited"
completed_addition = """

- [x] Treat the real-user Microsoft Defender detection on v0.2.9 as a release blocker.
- [x] Remove the hidden IMDb/TMDB WebView2 resolver, image-response capture, and portable artwork-file cache from the shipping native executable.
- [x] Restore the known Defender-safe v0.2.8 native network profile while retaining the compact layout, merged defaults, provider logic, and list management.
"""
mission = mission.replace(completed_anchor, completed_addition + "\n" + completed_anchor, 1)
open_addition = """
- [ ] Publish v0.2.10 and verify the downloadable Windows artifact no longer triggers the reported Defender detection.
- [ ] Reintroduce IMDb/TMDB multi-poster browsing only through an independently verified or signed implementation that does not trigger endpoint protection.
"""
mission = mission.replace(completed_anchor + "\n", completed_anchor + "\n\n" + open_addition, 1)
mission_path.write_text(mission, encoding="utf-8")

print("Applied v0.2.10 Defender-safe rollback.")
