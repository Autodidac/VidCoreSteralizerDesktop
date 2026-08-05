from pathlib import Path

root = Path(__file__).resolve().parents[2]
workflow = root / ".github/workflows/release.yml"
text = workflow.read_text(encoding="utf-8")

pull_request_block = """  pull_request:
    branches: [main]
    paths:
      - .github/release-v0.2.13-trigger
"""
job_condition = "    if: github.event_name != 'pull_request' || github.head_ref == 'release-v0.2.13-trigger'\n"

if pull_request_block not in text:
    raise RuntimeError("Temporary v0.2.13 pull-request trigger was not found.")
if job_condition not in text:
    raise RuntimeError("Temporary v0.2.13 job condition was not found.")

text = text.replace(pull_request_block, "", 1)
text = text.replace(job_condition, "", 1)
workflow.write_text(text, encoding="utf-8")
