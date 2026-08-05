from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / ".github" / "scripts" / "apply-v0.2.15.py"
text = path.read_text(encoding="utf-8")
block = '''replace_once(
    ".github/workflows/release.yml",
    "114 provider-aware built-in entries across 25 lists",
    "119 provider-aware built-in entries across 25 lists",
)
'''
if block not in text:
    raise RuntimeError("Expected release workflow replacement block was not found.")
path.write_text(text.replace(block, "", 1), encoding="utf-8")
