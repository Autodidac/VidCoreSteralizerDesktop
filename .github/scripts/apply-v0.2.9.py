from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "VidCoreNativePlayer/src/vidcore.artwork_resolver.ixx"
text = path.read_text(encoding="utf-8")
text = text.replace(
    '            const auto base =\n                L"https://www.themoviedb.org/" + type + L"/" + tmdb;',
    '            const auto base =\n                std::wstring{L"https://www.themoviedb.org/"} +\n                type + L"/" + tmdb;',
    1,
)
start = text.index("    void finish_discovery() {")
end = text.index("    void finish_cache(", start)
replacement = r'''    void finish_discovery() {
        if (!active_) return;
        const auto json =
            std::wstring{L"{\"imdbPrimary\":"} + active_->results[0] +
            L",\"imdbMore\":" + active_->results[1] +
            L",\"tmdbPrimary\":" + active_->results[2] +
            L",\"tmdbMore\":" + active_->results[3] + L"}";
        emit(
            L"artwork-sources|" + active_->request_id + L"|" + json
        );
        finish_current();
    }

'''
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8", newline="\n")
