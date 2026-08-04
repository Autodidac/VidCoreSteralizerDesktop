from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "VidCoreNativePlayer/src/vidcore.artwork_resolver.ixx"
text = path.read_text(encoding="utf-8")
start = text.index("    [[nodiscard]] static std::wstring normalize_json_array(")
end = text.index("    [[nodiscard]] static std::wstring file_stem(", start)
replacement = r'''    [[nodiscard]] static std::wstring normalize_json_array(
        std::wstring value
    ) {
        while (!value.empty() &&
               (value.front() == L' ' || value.front() == L'\r' ||
                value.front() == L'\n' || value.front() == L'\t')) {
            value.erase(value.begin());
        }
        while (!value.empty() &&
               (value.back() == L' ' || value.back() == L'\r' ||
                value.back() == L'\n' || value.back() == L'\t')) {
            value.pop_back();
        }
        return value.size() >= 2 &&
            value.front() == L'[' &&
            value.back() == L']'
                ? value
                : L"[]";
    }

'''
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8", newline="\n")
