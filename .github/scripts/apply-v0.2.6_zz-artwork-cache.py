from __future__ import annotations

from pathlib import Path
import re
import shutil

ROOT = Path.cwd()
NATIVE = ROOT / "VidCoreNativePlayer"
WEB = ROOT / "VidCoreWebPlayer"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing artwork-cache patch anchor: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Native WinHTTP image resolver/cache.
# ---------------------------------------------------------------------------
image_cache_module = r'''module;

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <optional>
#include <regex>
#include <sstream>
#include <string>
#include <string_view>
#include <unordered_set>
#include <utility>
#include <vector>
#include <windows.h>
#include <winhttp.h>

export module vidcore.image_cache;

export namespace vidcore {

struct CachedImage final {
    std::filesystem::path path;
    std::wstring source;
};

class ImageCache final {
public:
    explicit ImageCache(std::filesystem::path directory)
        : directory_{std::move(directory)} {
        std::error_code error;
        std::filesystem::create_directories(directory_, error);
    }

    [[nodiscard]] const std::filesystem::path& directory() const noexcept {
        return directory_;
    }

    [[nodiscard]] static std::wstring identity(
        std::wstring_view mode,
        std::wstring_view id,
        std::wstring_view imdb,
        std::wstring_view tmdb
    ) {
        const auto normalized_mode = mode == L"tv" ? L"tv" : L"movie";
        if (!imdb.empty()) {
            return std::wstring{normalized_mode} + L":imdb:" + lower(imdb);
        }
        if (!tmdb.empty()) {
            return std::wstring{normalized_mode} + L":tmdb:" + lower(tmdb);
        }
        return std::wstring{normalized_mode} + L":id:" + lower(id);
    }

    [[nodiscard]] std::optional<CachedImage> resolve(
        std::wstring_view mode,
        std::wstring_view id,
        std::wstring_view imdb,
        std::wstring_view tmdb
    ) {
        const auto cache_identity = identity(mode, id, imdb, tmdb);
        if (const auto existing = find_cached(cache_identity)) {
            return CachedImage{*existing, L"cache"};
        }

        std::wstring image_url;
        std::wstring source;

        auto effective_imdb = std::wstring{imdb};
        if (effective_imdb.empty() && id.starts_with(L"tt")) {
            effective_imdb = std::wstring{id};
        }

        auto effective_tmdb = std::wstring{tmdb};
        if (effective_tmdb.empty() &&
            !id.empty() &&
            std::all_of(id.begin(), id.end(), [](wchar_t value) {
                return value >= L'0' && value <= L'9';
            })) {
            effective_tmdb = std::wstring{id};
        }

        if (!effective_imdb.empty()) {
            image_url = imdb_image_url(effective_imdb);
            if (!image_url.empty()) {
                source = L"IMDb";
            }
        }

        if (image_url.empty() && !effective_tmdb.empty()) {
            image_url = tmdb_image_url(mode, effective_tmdb);
            if (!image_url.empty()) {
                source = L"TMDB";
            }
        }

        if (image_url.empty()) {
            return std::nullopt;
        }

        const auto response = http_get(image_url, 24U * 1024U * 1024U);
        if (!response || response->body.empty() || !looks_like_image(*response)) {
            return std::nullopt;
        }

        const auto extension = image_extension(*response, image_url);
        const auto destination = directory_ / (file_stem(cache_identity) + extension);
        const auto temporary = destination.wstring() + L".download";

        {
            std::ofstream output{
                std::filesystem::path{temporary},
                std::ios::binary | std::ios::trunc
            };
            if (!output) {
                return std::nullopt;
            }
            output.write(
                reinterpret_cast<const char*>(response->body.data()),
                static_cast<std::streamsize>(response->body.size())
            );
            if (!output) {
                return std::nullopt;
            }
        }

        std::error_code error;
        remove_variants(cache_identity);
        std::filesystem::rename(temporary, destination, error);
        if (error) {
            std::filesystem::remove(temporary, error);
            return std::nullopt;
        }

        return CachedImage{destination, source};
    }

    void remove(std::wstring_view cache_identity) {
        remove_variants(cache_identity);
    }

    void prune(std::wstring_view comma_separated_identities) {
        std::unordered_set<std::wstring> keep;
        std::size_t start = 0;
        while (start <= comma_separated_identities.size()) {
            const auto separator = comma_separated_identities.find(L',', start);
            const auto value = comma_separated_identities.substr(
                start,
                separator == std::wstring_view::npos
                    ? comma_separated_identities.size() - start
                    : separator - start
            );
            if (!value.empty()) {
                keep.insert(file_stem(value));
            }
            if (separator == std::wstring_view::npos) {
                break;
            }
            start = separator + 1;
        }

        std::error_code error;
        std::filesystem::create_directories(directory_, error);
        for (const auto& entry : std::filesystem::directory_iterator(
            directory_,
            std::filesystem::directory_options::skip_permission_denied,
            error
        )) {
            if (error || !entry.is_regular_file(error)) {
                continue;
            }
            const auto extension = lower(entry.path().extension().wstring());
            if (!known_extension(extension)) {
                continue;
            }
            if (!keep.contains(entry.path().stem().wstring())) {
                std::filesystem::remove(entry.path(), error);
                error.clear();
            }
        }
    }

private:
    class InternetHandle final {
    public:
        InternetHandle() = default;
        explicit InternetHandle(HINTERNET value) : value_{value} {}
        InternetHandle(const InternetHandle&) = delete;
        InternetHandle& operator=(const InternetHandle&) = delete;
        InternetHandle(InternetHandle&& other) noexcept
            : value_{std::exchange(other.value_, nullptr)} {}
        InternetHandle& operator=(InternetHandle&& other) noexcept {
            if (this != &other) {
                reset();
                value_ = std::exchange(other.value_, nullptr);
            }
            return *this;
        }
        ~InternetHandle() { reset(); }
        [[nodiscard]] HINTERNET get() const noexcept { return value_; }
        explicit operator bool() const noexcept { return value_ != nullptr; }
    private:
        void reset() noexcept {
            if (value_) {
                WinHttpCloseHandle(value_);
                value_ = nullptr;
            }
        }
        HINTERNET value_{};
    };

    struct HttpResponse final {
        std::vector<unsigned char> body;
        std::wstring content_type;
    };

    [[nodiscard]] static std::wstring lower(std::wstring_view value) {
        std::wstring result{value};
        std::transform(result.begin(), result.end(), result.begin(), [](wchar_t ch) {
            if (ch >= L'A' && ch <= L'Z') {
                return static_cast<wchar_t>(ch - L'A' + L'a');
            }
            return ch;
        });
        return result;
    }

    [[nodiscard]] static std::wstring utf8_to_wide(std::string_view value) {
        if (value.empty()) return {};
        const auto length = MultiByteToWideChar(
            CP_UTF8,
            0,
            value.data(),
            static_cast<int>(value.size()),
            nullptr,
            0
        );
        if (length <= 0) return {};
        std::wstring result(static_cast<std::size_t>(length), L'\0');
        MultiByteToWideChar(
            CP_UTF8,
            0,
            value.data(),
            static_cast<int>(value.size()),
            result.data(),
            length
        );
        return result;
    }

    [[nodiscard]] static std::string bytes_to_string(
        const std::vector<unsigned char>& bytes
    ) {
        return std::string{
            reinterpret_cast<const char*>(bytes.data()),
            bytes.size()
        };
    }

    [[nodiscard]] static std::wstring html_decode(std::wstring value) {
        const std::array replacements{
            std::pair{std::wstring_view{L"&amp;"}, std::wstring_view{L"&"}},
            std::pair{std::wstring_view{L"&#x2F;"}, std::wstring_view{L"/"}},
            std::pair{std::wstring_view{L"&#47;"}, std::wstring_view{L"/"}},
            std::pair{std::wstring_view{L"&quot;"}, std::wstring_view{L"\""}}
        };
        for (const auto& [from, to] : replacements) {
            std::size_t position = 0;
            while ((position = value.find(from, position)) != std::wstring::npos) {
                value.replace(position, from.size(), to);
                position += to.size();
            }
        }
        return value;
    }

    [[nodiscard]] static std::wstring json_decode(std::wstring value) {
        const std::array replacements{
            std::pair{std::wstring_view{L"\\/"}, std::wstring_view{L"/"}},
            std::pair{std::wstring_view{L"\\u0026"}, std::wstring_view{L"&"}},
            std::pair{std::wstring_view{L"\\u003d"}, std::wstring_view{L"="}},
            std::pair{std::wstring_view{L"\\u002F"}, std::wstring_view{L"/"}},
            std::pair{std::wstring_view{L"\\u002f"}, std::wstring_view{L"/"}}
        };
        for (const auto& [from, to] : replacements) {
            std::size_t position = 0;
            while ((position = value.find(from, position)) != std::wstring::npos) {
                value.replace(position, from.size(), to);
                position += to.size();
            }
        }
        return value;
    }

    [[nodiscard]] static std::optional<HttpResponse> http_get(
        const std::wstring& url,
        std::size_t maximum_bytes
    ) {
        URL_COMPONENTS components{};
        components.dwStructSize = sizeof(components);
        components.dwSchemeLength = static_cast<DWORD>(-1);
        components.dwHostNameLength = static_cast<DWORD>(-1);
        components.dwUrlPathLength = static_cast<DWORD>(-1);
        components.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(url.c_str(), 0, 0, &components)) {
            return std::nullopt;
        }

        const std::wstring host{
            components.lpszHostName,
            components.dwHostNameLength
        };
        std::wstring path{
            components.lpszUrlPath,
            components.dwUrlPathLength
        };
        if (components.dwExtraInfoLength > 0) {
            path.append(components.lpszExtraInfo, components.dwExtraInfoLength);
        }
        if (path.empty()) path = L"/";

        InternetHandle session{WinHttpOpen(
            L"ShieldedNativeStreamPlayer/0.2.6 Mozilla/5.0",
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            WINHTTP_NO_PROXY_NAME,
            WINHTTP_NO_PROXY_BYPASS,
            0
        )};
        if (!session) return std::nullopt;
        WinHttpSetTimeouts(session.get(), 5000, 7000, 7000, 12000);

        InternetHandle connection{WinHttpConnect(
            session.get(),
            host.c_str(),
            components.nPort,
            0
        )};
        if (!connection) return std::nullopt;

        const DWORD flags = components.nScheme == INTERNET_SCHEME_HTTPS
            ? WINHTTP_FLAG_SECURE
            : 0;
        InternetHandle request{WinHttpOpenRequest(
            connection.get(),
            L"GET",
            path.c_str(),
            nullptr,
            WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            flags
        )};
        if (!request) return std::nullopt;

        constexpr auto headers =
            L"Accept: text/html,application/json,image/avif,image/webp,image/apng,image/*,*/*;q=0.8\r\n"
            L"Accept-Language: en-US,en;q=0.9\r\n"
            L"Cache-Control: no-cache\r\n";
        WinHttpAddRequestHeaders(
            request.get(),
            headers,
            static_cast<DWORD>(-1),
            WINHTTP_ADDREQ_FLAG_ADD
        );

        if (!WinHttpSendRequest(
            request.get(),
            WINHTTP_NO_ADDITIONAL_HEADERS,
            0,
            WINHTTP_NO_REQUEST_DATA,
            0,
            0,
            0
        ) || !WinHttpReceiveResponse(request.get(), nullptr)) {
            return std::nullopt;
        }

        DWORD status = 0;
        DWORD status_size = sizeof(status);
        if (!WinHttpQueryHeaders(
            request.get(),
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX,
            &status,
            &status_size,
            WINHTTP_NO_HEADER_INDEX
        ) || status < 200 || status >= 300) {
            return std::nullopt;
        }

        std::wstring content_type;
        DWORD content_type_size = 0;
        WinHttpQueryHeaders(
            request.get(),
            WINHTTP_QUERY_CONTENT_TYPE,
            WINHTTP_HEADER_NAME_BY_INDEX,
            nullptr,
            &content_type_size,
            WINHTTP_NO_HEADER_INDEX
        );
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && content_type_size > 0) {
            content_type.resize(content_type_size / sizeof(wchar_t));
            if (WinHttpQueryHeaders(
                request.get(),
                WINHTTP_QUERY_CONTENT_TYPE,
                WINHTTP_HEADER_NAME_BY_INDEX,
                content_type.data(),
                &content_type_size,
                WINHTTP_NO_HEADER_INDEX
            )) {
                while (!content_type.empty() && content_type.back() == L'\0') {
                    content_type.pop_back();
                }
            } else {
                content_type.clear();
            }
        }

        std::vector<unsigned char> body;
        while (body.size() < maximum_bytes) {
            DWORD available = 0;
            if (!WinHttpQueryDataAvailable(request.get(), &available)) {
                return std::nullopt;
            }
            if (available == 0) break;
            const auto remaining = maximum_bytes - body.size();
            const auto chunk_size = static_cast<DWORD>(
                std::min<std::size_t>(available, remaining)
            );
            const auto offset = body.size();
            body.resize(offset + chunk_size);
            DWORD read = 0;
            if (!WinHttpReadData(
                request.get(),
                body.data() + offset,
                chunk_size,
                &read
            )) {
                return std::nullopt;
            }
            body.resize(offset + read);
            if (read == 0) break;
        }

        if (body.empty() || body.size() >= maximum_bytes) {
            return std::nullopt;
        }
        return HttpResponse{std::move(body), lower(content_type)};
    }

    [[nodiscard]] static std::wstring extract_regex(
        const std::string& text,
        const std::regex& pattern
    ) {
        std::smatch match;
        if (!std::regex_search(text, match, pattern) || match.size() < 2) {
            return {};
        }
        return utf8_to_wide(match[1].str());
    }

    [[nodiscard]] static std::wstring imdb_image_url(
        std::wstring_view imdb
    ) {
        const auto suggestion_url =
            std::wstring{L"https://v2.sg.media-imdb.com/suggestion/t/"} +
            std::wstring{imdb} + L".json";
        if (const auto response = http_get(suggestion_url, 3U * 1024U * 1024U)) {
            static const std::regex image_pattern{
                R"json("imageUrl"\s*:\s*"([^"]+)")json",
                std::regex::icase
            };
            auto image = extract_regex(bytes_to_string(response->body), image_pattern);
            image = json_decode(std::move(image));
            if (image.starts_with(L"https://")) {
                return image;
            }
        }

        const auto title_url =
            std::wstring{L"https://www.imdb.com/title/"} +
            std::wstring{imdb} + L"/";
        if (const auto response = http_get(title_url, 5U * 1024U * 1024U)) {
            return extract_page_image(bytes_to_string(response->body));
        }
        return {};
    }

    [[nodiscard]] static std::wstring tmdb_image_url(
        std::wstring_view mode,
        std::wstring_view tmdb
    ) {
        const auto type = mode == L"tv" ? L"tv" : L"movie";
        const auto url =
            std::wstring{L"https://www.themoviedb.org/"} +
            type + L"/" + std::wstring{tmdb};
        if (const auto response = http_get(url, 5U * 1024U * 1024U)) {
            return extract_page_image(bytes_to_string(response->body));
        }
        return {};
    }

    [[nodiscard]] static std::wstring extract_page_image(
        const std::string& html
    ) {
        static const std::array patterns{
            std::regex{
                R"meta(<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]+content\s*=\s*["']([^"']+)["'])meta",
                std::regex::icase
            },
            std::regex{
                R"meta(<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'])meta",
                std::regex::icase
            }
        };
        for (const auto& pattern : patterns) {
            auto image = html_decode(extract_regex(html, pattern));
            if (image.starts_with(L"https://")) {
                return image;
            }
        }
        return {};
    }

    [[nodiscard]] static bool looks_like_image(const HttpResponse& response) {
        if (response.content_type.starts_with(L"image/")) return true;
        const auto& bytes = response.body;
        if (bytes.size() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        if (bytes.size() >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        if (bytes.size() >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return true;
        if (bytes.size() >= 6 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') return true;
        return false;
    }

    [[nodiscard]] static std::wstring image_extension(
        const HttpResponse& response,
        std::wstring_view url
    ) {
        if (response.content_type.find(L"png") != std::wstring::npos) return L".png";
        if (response.content_type.find(L"webp") != std::wstring::npos) return L".webp";
        if (response.content_type.find(L"avif") != std::wstring::npos) return L".avif";
        if (response.content_type.find(L"gif") != std::wstring::npos) return L".gif";
        const auto lowered = lower(url);
        for (const auto extension : {L".png", L".webp", L".avif", L".gif"}) {
            if (lowered.find(extension) != std::wstring::npos) return extension;
        }
        return L".jpg";
    }

    [[nodiscard]] static bool known_extension(std::wstring_view value) {
        return value == L".jpg" || value == L".jpeg" || value == L".png" ||
            value == L".webp" || value == L".avif" || value == L".gif";
    }

    [[nodiscard]] static std::wstring file_stem(std::wstring_view identity) {
        std::wstring readable;
        readable.reserve(identity.size());
        for (const auto ch : identity) {
            if ((ch >= L'a' && ch <= L'z') ||
                (ch >= L'0' && ch <= L'9') || ch == L'-') {
                readable.push_back(ch);
            } else if (ch >= L'A' && ch <= L'Z') {
                readable.push_back(static_cast<wchar_t>(ch - L'A' + L'a'));
            } else {
                readable.push_back(L'-');
            }
        }
        while (readable.find(L"--") != std::wstring::npos) {
            readable.replace(readable.find(L"--"), 2, L"-");
        }
        if (readable.size() <= 72 && !readable.empty()) {
            return readable;
        }

        std::uint64_t hash = 1469598103934665603ULL;
        for (const auto ch : identity) {
            hash ^= static_cast<std::uint64_t>(ch);
            hash *= 1099511628211ULL;
        }
        std::wostringstream stream;
        stream << L"media-" << std::hex << std::setw(16) << std::setfill(L'0') << hash;
        return stream.str();
    }

    [[nodiscard]] std::optional<std::filesystem::path> find_cached(
        std::wstring_view identity
    ) const {
        const auto stem = file_stem(identity);
        for (const auto extension : {L".jpg", L".jpeg", L".png", L".webp", L".avif", L".gif"}) {
            const auto candidate = directory_ / (stem + extension);
            std::error_code error;
            if (std::filesystem::is_regular_file(candidate, error)) {
                return candidate;
            }
        }
        return std::nullopt;
    }

    void remove_variants(std::wstring_view identity) {
        const auto stem = file_stem(identity);
        std::error_code error;
        for (const auto extension : {L".jpg", L".jpeg", L".png", L".webp", L".avif", L".gif"}) {
            std::filesystem::remove(directory_ / (stem + extension), error);
            error.clear();
        }
    }

    std::filesystem::path directory_;
};

} // namespace vidcore
'''
write(NATIVE / "src" / "vidcore.image_cache.ixx", image_cache_module)

# ---------------------------------------------------------------------------
# CMake: compile the module and link WinHTTP.
# ---------------------------------------------------------------------------
cmake_path = NATIVE / "CMakeLists.txt"
cmake = read(cmake_path)
cmake = replace_once(
    cmake,
    "            src/vidcore.blocklist.ixx\n            src/vidcore.webview.ixx",
    "            src/vidcore.blocklist.ixx\n            src/vidcore.image_cache.ixx\n            src/vidcore.webview.ixx",
    "image cache module source",
)
cmake = replace_once(
    cmake,
    "        shlwapi\n        dwmapi",
    "        shlwapi\n        winhttp\n        dwmapi",
    "WinHTTP library",
)
write(cmake_path, cmake)

# ---------------------------------------------------------------------------
# WebView host: resolve/cache/prune/remove commands and silent shield.
# ---------------------------------------------------------------------------
webview_path = NATIVE / "src" / "vidcore.webview.ixx"
webview = read(webview_path)
webview = replace_once(
    webview,
    "import vidcore.blocklist;\nimport vidcore.uri;",
    "import vidcore.blocklist;\nimport vidcore.image_cache;\nimport vidcore.uri;",
    "image cache import",
)
webview = replace_once(
    webview,
    '''        if (command == L"ready") {
            post_event(L"blocked-count|" + std::to_wstring(blocklist_.size()));
            post_event(L"zoom|1.00");''',
    '''        if (command == L"ready") {
            post_event(L"zoom|1.00");''',
    "silent ready shield",
)
image_commands = r'''

        if (command == L"resolve-image") {
            std::array<std::wstring, 5> fields{};
            std::size_t field_index = 0;
            std::size_t start = 0;
            while (field_index < fields.size()) {
                const auto next = payload.find(L'|', start);
                fields[field_index++] = payload.substr(
                    start,
                    next == std::wstring::npos
                        ? std::wstring::npos
                        : next - start
                );
                if (next == std::wstring::npos) break;
                start = next + 1;
            }

            const auto result = image_cache_.resolve(
                fields[1],
                fields[2],
                fields[3],
                fields[4]
            );
            if (result) {
                post_event(
                    L"image-resolved|" + fields[0] + L"|" +
                    uri::file_url(result->path) + L"|" + result->source
                );
            } else {
                post_event(L"image-resolved|" + fields[0] + L"||none");
            }
            return;
        }

        if (command == L"delete-image-cache") {
            image_cache_.remove(payload);
            return;
        }

        if (command == L"prune-image-cache") {
            image_cache_.prune(payload);
            return;
        }
'''
webview = replace_once(
    webview,
    '''        if (command == L"mute") {''',
    image_commands + '''
        if (command == L"mute") {''',
    "image cache host commands",
)
webview = replace_once(
    webview,
    '''        if (command == L"clear-blocklist") {
            blocklist_.clear();
            post_event(L"blocked-count|0");
            post_event(L"blocked-cleared|");''',
    '''        if (command == L"clear-blocklist") {
            blocklist_.clear();
            post_event(L"blocked-cleared|");''',
    "silent clear shield",
)
webview = replace_once(
    webview,
    '''        post_event(event);
        post_event(L"blocked-count|" + std::to_wstring(blocklist_.size()));
    }''',
    '''        post_event(event);
    }''',
    "silent block events",
)
webview = replace_once(
    webview,
    '''    PopupBlocklist blocklist_;
    ErrorHandler error_handler_;''',
    '''    PopupBlocklist blocklist_;
    ImageCache image_cache_{executable_directory() / L"cache"};
    ErrorHandler error_handler_;''',
    "image cache member",
)
write(webview_path, webview)

# ---------------------------------------------------------------------------
# Metadata: local cache images are trusted; existing strict sources fallback.
# ---------------------------------------------------------------------------
metadata_path = NATIVE / "assets" / "metadata.js"
metadata = read(metadata_path)
metadata = replace_once(
    metadata,
    '''  function isLikelyBadArtwork(entry, metadata, image, sourceKind = "image") {
    if (!image) return false;
    if (sourceKind === "poster" || sourceKind === "logo") return false;''',
    '''  function isLikelyBadArtwork(entry, metadata, image, sourceKind = "image") {
    if (!image) return false;
    try {
      if (new URL(String(image)).protocol === "file:") return false;
    } catch {
    }
    if (sourceKind === "poster" || sourceKind === "logo") return false;''',
    "trust local cache artwork",
)
write(metadata_path, metadata)

# ---------------------------------------------------------------------------
# App bridge: official artwork overrides fallback, cache lifecycle follows list.
# ---------------------------------------------------------------------------
app_path = NATIVE / "assets" / "app.js"
app = read(app_path)
app = replace_once(
    app,
    '''    dialogEntry: null,
    scanner: null
  };''',
    '''    dialogEntry: null,
    scanner: null,
    artworkSequence: 0,
    artworkRequests: new Map()
  };''',
    "artwork bridge state",
)
artwork_bridge = r'''

  function mediaCacheIdentity(entry, metadata = entry) {
    const mode = entry?.mode === "tv" ? "tv" : "movie";
    const imdb = String(metadata?.imdb || (/^tt\d+$/i.test(entry?.id || "") ? entry.id : "")).toLowerCase();
    if (imdb) return `${mode}:imdb:${imdb}`;
    const tmdb = String(metadata?.tmdb || (/^\d+$/.test(entry?.id || "") ? entry.id : ""));
    if (tmdb) return `${mode}:tmdb:${tmdb}`;
    return `${mode}:id:${String(entry?.id || "unknown").toLowerCase()}`;
  }

  function requestNativeArtwork(entry, metadata = entry) {
    if (!globalThis.chrome?.webview) {
      return Promise.resolve("");
    }

    const requestId = String(++state.artworkSequence);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        state.artworkRequests.delete(requestId);
        resolve("");
      }, 18000);
      state.artworkRequests.set(requestId, { resolve, timer });
      postHost([
        "resolve-image",
        requestId,
        entry.mode === "tv" ? "tv" : "movie",
        entry.id || "",
        metadata?.imdb || "",
        metadata?.tmdb || ""
      ].join("|"));
    });
  }

  async function preferOfficialArtwork(entry, metadata) {
    try {
      const image = await requestNativeArtwork(entry, metadata);
      return image
        ? {
            ...metadata,
            image,
            artworkSource: "IMDb/TMDB local cache"
          }
        : metadata;
    } catch {
      return metadata;
    }
  }

  async function pruneNativeArtworkCache() {
    if (!state.storageReady || !globalThis.chrome?.webview) return;
    const favorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    const identities = [...new Set(
      favorites.map(entry => mediaCacheIdentity(entry, entry))
    )];
    postHost(`prune-image-cache|${identities.join(",")}`);
  }
'''
app = replace_once(
    app,
    '''  function setStatus(title, text, type = "") {''',
    artwork_bridge + '''
  function setStatus(title, text, type = "") {''',
    "native artwork bridge",
)
app = replace_once(
    app,
    '''    const metadata = await VidCoreMetadata.resolve(entry);

    if (isCurrentEntry(entry)) {''',
    '''    let metadata = await VidCoreMetadata.resolve(entry);
    metadata = await preferOfficialArtwork(entry, metadata);

    if (isCurrentEntry(entry)) {''',
    "IMDb TMDB artwork priority",
)
app = replace_once(
    app,
    '''        async (entry, metadata) => {
          await VidCoreStorage.put(''',
    '''        async (entry, metadata) => {
          const officialMetadata = await preferOfficialArtwork(entry, metadata);
          await VidCoreStorage.put(''',
    "list official artwork resolver",
)
app = replace_once(
    app,
    '''              ...entry,
              ...metadata,
              updatedAt: new Date().toISOString()''',
    '''              ...entry,
              ...officialMetadata,
              updatedAt: new Date().toISOString()''',
    "list stored official metadata",
)
app = replace_once(
    app,
    '''          state.scanner?.addResolvedImage({
            ...entry,
            ...metadata
          });''',
    '''          state.scanner?.addResolvedImage({
            ...entry,
            ...officialMetadata
          });''',
    "list queue official metadata",
)
# After saving, cache and replace the stored image once.
app = replace_once(
    app,
    '''    if (elements.saveWatched.checked) {''',
    '''    const cachedImage = await requestNativeArtwork(entry, {
      ...existing,
      ...(metadata || {})
    });
    if (cachedImage) {
      const saved = await VidCoreStorage.get(
        VidCoreStorage.STORES.favorites,
        key
      );
      if (saved) {
        await VidCoreStorage.put(
          VidCoreStorage.STORES.favorites,
          {
            ...saved,
            image: cachedImage,
            artworkSource: "IMDb/TMDB local cache",
            updatedAt: new Date().toISOString()
          }
        );
      }
    }

    if (elements.saveWatched.checked) {''',
    "cache image after save",
)
app = replace_once(
    app,
    '''    await VidCoreStorage.remove(
      VidCoreStorage.STORES.favorites,
      key
    );
    if (elements.saveDialog.open) {''',
    '''    await VidCoreStorage.remove(
      VidCoreStorage.STORES.favorites,
      key
    );
    const identity = mediaCacheIdentity(entry, entry);
    const remainingFavorites = await VidCoreStorage.getAll(
      VidCoreStorage.STORES.favorites
    );
    if (!remainingFavorites.some(candidate =>
      mediaCacheIdentity(candidate, candidate) === identity
    )) {
      postHost(`delete-image-cache|${identity}`);
    }
    if (elements.saveDialog.open) {''',
    "delete cached image with final favorite",
)
app = replace_once(
    app,
    '''      await renderAllLibraryViews();
      renderRecommended();

      setStatus(
        "Backup imported",''',
    '''      await renderAllLibraryViews();
      renderRecommended();
      await pruneNativeArtworkCache();

      setStatus(
        "Backup imported",''',
    "prune cache after import",
)
app = replace_once(
    app,
    '''    if (command === "blocked-cleared") {''',
    '''    if (command === "image-resolved") {
      const second = payload.indexOf("|");
      const requestId = second < 0 ? payload : payload.slice(0, second);
      const remainder = second < 0 ? "" : payload.slice(second + 1);
      const third = remainder.indexOf("|");
      const image = third < 0 ? remainder : remainder.slice(0, third);
      const pending = state.artworkRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        state.artworkRequests.delete(requestId);
        pending.resolve(image || "");
      }
      return;
    }

    if (command === "blocked-cleared") {''',
    "image resolved host event",
)
app = replace_once(
    app,
    '''      await renderAllLibraryViews();
      const migrated = migration.favorites + migration.history;''',
    '''      await renderAllLibraryViews();
      await pruneNativeArtworkCache();
      const migrated = migration.favorites + migration.history;''',
    "startup cache prune",
)
write(app_path, app)

# Mirror browser-safe changes. Native commands are optional and no-op in web mode.
for name in ["app.js", "metadata.js"]:
    shutil.copy2(NATIVE / "assets" / name, WEB / name)

# ---------------------------------------------------------------------------
# Tests and mission ledger.
# ---------------------------------------------------------------------------
logic_path = NATIVE / "tests" / "logic.test.mjs"
logic = read(logic_path)
if "file:///cache/movie-imdb" not in logic:
    logic += '''

assert.equal(
  metadata.isLikelyBadArtwork(
    { mode: "movie", id: "tt0283003", title: "Snow Dogs" },
    { title: "Snow Dogs" },
    "file:///cache/movie-imdb-tt0283003.jpg"
  ),
  false
);
'''
write(logic_path, logic)

smoke_path = NATIVE / "tests" / "static-smoke.test.mjs"
smoke = read(smoke_path)
if 'const imageCache = fs.readFileSync' not in smoke:
    smoke = replace_once(
        smoke,
        'const webview = fs.readFileSync(path.join(root, "src", "vidcore.webview.ixx"), "utf8");',
        'const webview = fs.readFileSync(path.join(root, "src", "vidcore.webview.ixx"), "utf8");\nconst imageCache = fs.readFileSync(path.join(root, "src", "vidcore.image_cache.ixx"), "utf8");\nconst cmake = fs.readFileSync(path.join(root, "CMakeLists.txt"), "utf8");',
        "native image cache smoke inputs",
    )
    smoke += '''

assert.match(app, /resolve-image/);
assert.match(app, /prune-image-cache/);
assert.match(app, /delete-image-cache/);
assert.match(app, /preferOfficialArtwork/);
assert.match(webview, /ImageCache/);
assert.match(webview, /image-resolved/);
assert.doesNotMatch(webview, /blocked-count/);
assert.match(imageCache, /media-imdb/);
assert.match(imageCache, /v2\\.sg\\.media-imdb\\.com/);
assert.match(imageCache, /themoviedb\\.org/);
assert.match(imageCache, /WinHttpOpen/);
assert.match(cmake, /vidcore\\.image_cache\\.ixx/);
assert.match(cmake, /winhttp/);
'''
write(smoke_path, smoke)

readme_path = NATIVE / "README.md"
readme = read(readme_path)
cache_docs = '''

## IMDb/TMDB artwork cache

Resolved title artwork now follows this order:

1. IMDb title imagery, using IMDb's title suggestion/media data.
2. TMDB title-page Open Graph imagery.
3. Strict Wikidata/Wikipedia/Wikimedia fallbacks only when neither official title source resolves.

The native executable stores downloaded artwork in `cache/` beside `VidCoreNativePlayer.exe`. Cache identity is based on the media identifier rather than the selected playback provider, so VidCore, YTHD, and VidUp reuse the same file. Removing the final saved library copy deletes its cached image, and startup/import pruning removes orphaned files.
'''
if "## IMDb/TMDB artwork cache" not in readme:
    readme += cache_docs
write(readme_path, readme)

mission_path = ROOT / "missioncache.md"
mission = read(mission_path)
completed = '''
- [x] Resolve artwork from IMDb title/media imagery first instead of using Wikipedia as the primary image source.
- [x] Use TMDB title/backdrop imagery as the second official artwork source.
- [x] Keep strict Wikidata, Wikipedia, and Wikimedia Commons artwork only as fallback sources.
- [x] Cache resolved native artwork in `cache/` beside the executable with readable media-based filenames.
- [x] Reuse one cached image across VidCore, YTHD, and VidUp provider selections.
- [x] Reuse cached artwork without repeating IMDb/TMDB requests while the title remains saved.
- [x] Delete cached artwork when the final saved library copy is removed.
- [x] Prune orphaned cache images at startup and after backup import.
'''
if "Resolve artwork from IMDb title/media imagery first" not in mission:
    mission = mission.replace("\n## Open / provider-limited", "\n" + completed + "\n## Open / provider-limited")
write(mission_path, mission)

print("Applied IMDb-first, TMDB-second native artwork resolution and cache lifecycle.")
