from pathlib import Path

root = Path(__file__).resolve().parents[2]
test = root / "VidCoreNativePlayer/tests/logic.test.mjs"
text = test.read_text(encoding="utf-8")
old = '  image: "https://example.invalid/poster.jpg"\n'
new = '  image: "https://example.invalid/test-poster.jpg"\n'
if old not in text:
    raise RuntimeError("Scanner artwork fixture was not found.")
test.write_text(text.replace(old, new, 1), encoding="utf-8")

mission = root / "missioncache.md"
text = mission.read_text(encoding="utf-8")
anchor = "- [x] Resolve an exact Wikidata entity's title before validating its artwork so valid title-matching posters are not compared against generic Movie/TV ID placeholders.\n"
addition = anchor + "- [x] Update scanner test artwork to carry the resolved title identity instead of relying on an unqualified poster filename that production now rejects.\n"
if addition not in text:
    if anchor not in text:
        raise RuntimeError("Mission-cache title-order anchor was not found.")
    text = text.replace(anchor, addition, 1)
mission.write_text(text, encoding="utf-8")
