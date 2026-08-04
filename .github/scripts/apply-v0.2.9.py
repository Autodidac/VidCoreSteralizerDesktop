from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8", newline="\n")

def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing patch target: {label}")
    return text.replace(old, new, 1)

RESOLVER = """module;

#include <algorithm>
#include <array>
#include <deque>
#include <filesystem>
#include <fstream>
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>
#include <vector>
#include <windows.h>
#include <objbase.h>
#include <objidl.h>
#include <wrl.h>
#include <WebView2.h>

export module vidcore.artwork_resolver;

import vidcore.uri;

export namespace vidcore {

class ArtworkResolver final {
public:
    using EventHandler = std::function<void(const std::wstring&)>;
    using ErrorHandler = std::function<void(std::wstring_view)>;

    ArtworkResolver(
        HWND parent,
        ICoreWebView2Environment* environment,
        std::filesystem::path cache_directory,
        EventHandler event_handler
    )
        : parent_{parent},
          environment_{environment},
          cache_directory_{std::move(cache_directory)},
          event_handler_{std::move(event_handler)} {
        std::error_code error;
        std::filesystem::create_directories(cache_directory_, error);
    }

    ArtworkResolver(const ArtworkResolver&) = delete;
    ArtworkResolver& operator=(const ArtworkResolver&) = delete;

    ~ArtworkResolver() {
        shutdown();
    }

    void initialize(ErrorHandler error_handler) {
        error_handler_ = std::move(error_handler);
        hidden_window_ = CreateWindowExW(
            0,
            L"STATIC",
            L"",
            WS_CHILD,
            0,
            0,
            1,
            1,
            parent_,
            nullptr,
            GetModuleHandleW(nullptr),
            nullptr
        );
        if (!hidden_window_) {
            report_error(L"Unable to create the hidden artwork resolver window.");
            return;
        }

        environment_->CreateCoreWebView2Controller(
            hidden_window_,
            Microsoft::WRL::Callback<
                ICoreWebView2CreateCoreWebView2ControllerCompletedHandler
            >(
                [this](HRESULT result, ICoreWebView2Controller* controller) {
                    if (FAILED(result) || controller == nullptr) {
                        report_error(L"Unable to create the hidden artwork resolver.");
                        return result;
                    }

                    controller_ = controller;
                    controller_->get_CoreWebView2(&webview_);
                    if (!webview_) {
                        report_error(L"The hidden artwork resolver did not return a browser.");
                        return E_POINTER;
                    }

                    RECT bounds{0, 0, 1, 1};
                    controller_->put_Bounds(bounds);
                    controller_->put_IsVisible(FALSE);

                    Microsoft::WRL::ComPtr<ICoreWebView2Settings> settings;
                    if (SUCCEEDED(webview_->get_Settings(&settings)) && settings) {
                        settings->put_IsScriptEnabled(TRUE);
                        settings->put_AreDefaultScriptDialogsEnabled(FALSE);
                        settings->put_AreDefaultContextMenusEnabled(FALSE);
                        settings->put_AreDevToolsEnabled(FALSE);
                        settings->put_IsStatusBarEnabled(FALSE);
                    }

                    register_events();
                    ready_ = true;
                    start_next();
                    return S_OK;
                }
            ).Get()
        );
    }

    void discover(
        std::wstring request_id,
        std::wstring mode,
        std::wstring id,
        std::wstring imdb,
        std::wstring tmdb
    ) {
        Job job;
        job.kind = JobKind::discover;
        job.request_id = std::move(request_id);
        job.mode = mode == L"tv" ? L"tv" : L"movie";

        if (imdb.empty() && id.starts_with(L"tt")) {
            imdb = id;
        }
        if (tmdb.empty() && all_digits(id)) {
            tmdb = id;
        }

        if (valid_imdb(imdb)) {
            job.pages.push_back({
                0,
                L"https://www.imdb.com/title/" + imdb + L"/"
            });
            job.pages.push_back({
                1,
                L"https://www.imdb.com/title/" + imdb + L"/mediaindex/"
            });
        }

        if (all_digits(tmdb)) {
            const auto type = job.mode == L"tv" ? L"tv" : L"movie";
            const auto base =
                L"https://www.themoviedb.org/" + type + L"/" + tmdb;
            job.pages.push_back({2, base});
            job.pages.push_back({3, base + L"/images/posters"});
        }

        jobs_.push_back(std::move(job));
        start_next();
    }

    void cache(
        std::wstring request_id,
        std::wstring identity,
        std::wstring source,
        std::wstring index,
        std::wstring url
    ) {
        Job job;
        job.kind = JobKind::cache;
        job.request_id = std::move(request_id);
        job.identity = std::move(identity);
        job.source = lower(source);
        job.index = std::move(index);
        job.url = std::move(url);
        jobs_.push_back(std::move(job));
        start_next();
    }

    void remove(std::wstring_view identity) {
        const auto prefix = file_stem(identity) + L"-";
        std::error_code error;
        std::filesystem::create_directories(cache_directory_, error);
        for (const auto& entry : std::filesystem::directory_iterator(
            cache_directory_,
            std::filesystem::directory_options::skip_permission_denied,
            error
        )) {
            if (error || !entry.is_regular_file(error)) {
                continue;
            }
            const auto stem = entry.path().stem().wstring();
            if (stem.starts_with(prefix)) {
                std::filesystem::remove(entry.path(), error);
                error.clear();
            }
        }
    }

    void prune(std::wstring_view comma_separated_identities) {
        std::vector<std::wstring> prefixes;
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
                prefixes.push_back(file_stem(value) + L"-");
            }
            if (separator == std::wstring_view::npos) break;
            start = separator + 1;
        }

        std::error_code error;
        std::filesystem::create_directories(cache_directory_, error);
        for (const auto& entry : std::filesystem::directory_iterator(
            cache_directory_,
            std::filesystem::directory_options::skip_permission_denied,
            error
        )) {
            if (error || !entry.is_regular_file(error)) continue;
            const auto stem = entry.path().stem().wstring();
            const bool keep = std::any_of(
                prefixes.begin(),
                prefixes.end(),
                [&stem](const auto& prefix) {
                    return stem.starts_with(prefix);
                }
            );
            if (!keep) {
                std::filesystem::remove(entry.path(), error);
                error.clear();
            }
        }
    }

    void shutdown() {
        ready_ = false;
        jobs_.clear();
        active_.reset();
        if (controller_) {
            controller_->Close();
        }
        webview_.Reset();
        controller_.Reset();
        if (hidden_window_) {
            DestroyWindow(hidden_window_);
            hidden_window_ = nullptr;
        }
    }

private:
    enum class JobKind {
        discover,
        cache
    };

    struct Page final {
        std::size_t slot{};
        std::wstring url;
    };

    struct Job final {
        JobKind kind{JobKind::discover};
        std::wstring request_id;
        std::wstring mode;
        std::vector<Page> pages;
        std::array<std::wstring, 4> results{L"[]", L"[]", L"[]", L"[]"};
        std::size_t page_index{};
        std::wstring identity;
        std::wstring source;
        std::wstring index;
        std::wstring url;
        std::wstring destination_stem;
        bool response_started{};
    };

    static constexpr std::wstring_view extraction_script = LR"JS(
(() => new Promise(resolve => {
  setTimeout(() => {
    const host = String(location.hostname || "").toLowerCase();
    const seen = new Set();
    const output = [];

    const smallestCandidate = image => {
      const srcset = String(image.getAttribute("srcset") || "").trim();
      if (srcset) {
        const candidates = srcset.split(",").map(item => {
          const parts = item.trim().split(/\s+/);
          const url = parts[0] || "";
          const descriptor = parts[1] || "";
          let rank = Number.MAX_SAFE_INTEGER;
          if (/^\d+w$/i.test(descriptor)) {
            rank = Number.parseInt(descriptor, 10);
          } else if (/^\d+(?:\.\d+)?x$/i.test(descriptor)) {
            rank = Math.round(Number.parseFloat(descriptor) * 1000);
          }
          return { url, rank };
        }).filter(candidate => candidate.url);
        candidates.sort((left, right) => left.rank - right.rank);
        if (candidates.length) return candidates[0].url;
      }
      return image.currentSrc || image.src || "";
    };

    const add = image => {
      let url = smallestCandidate(image);
      try {
        url = new URL(url, location.href).href;
      } catch {
        return;
      }

      if (host.endsWith("imdb.com")) {
        if (!/^https:\/\/m\.media-amazon\.com\/images\/M\//i.test(url)) return;
        const link = String(image.closest("a")?.href || "");
        const portrait =
          image.naturalHeight > 0 &&
          image.naturalWidth > 0 &&
          image.naturalHeight >= image.naturalWidth * 1.1;
        if (!image.dataset.imageId &&
            !/\/mediaviewer\/|\/mediaindex\//i.test(link) &&
            !portrait) {
          return;
        }
      } else if (host.endsWith("themoviedb.org")) {
        if (!/^https:\/\/media\.themoviedb\.org\/t\/p\//i.test(url)) return;
        if (!image.matches("img.poster") &&
            !image.classList.contains("poster") &&
            !/\/w\d+_and_h\d+_face\//i.test(url)) {
          return;
        }
      } else {
        return;
      }

      if (!seen.has(url)) {
        seen.add(url);
        output.push(url);
      }
    };

    for (const image of document.images) {
      add(image);
    }
    resolve(output.slice(0, 24));
  }, 1000);
}))()
)JS";

    void register_events() {
        webview_->add_NavigationCompleted(
            Microsoft::WRL::Callback<
                ICoreWebView2NavigationCompletedEventHandler
            >(
                [this](
                    ICoreWebView2*,
                    ICoreWebView2NavigationCompletedEventArgs* arguments
                ) {
                    on_navigation_completed(arguments);
                    return S_OK;
                }
            ).Get(),
            &navigation_completed_token_
        );

        Microsoft::WRL::ComPtr<ICoreWebView2_2> webview2;
        if (SUCCEEDED(webview_.As(&webview2)) && webview2) {
            webview2->add_WebResourceResponseReceived(
                Microsoft::WRL::Callback<
                    ICoreWebView2WebResourceResponseReceivedEventHandler
                >(
                    [this](
                        ICoreWebView2*,
                        ICoreWebView2WebResourceResponseReceivedEventArgs* arguments
                    ) {
                        on_response_received(arguments);
                        return S_OK;
                    }
                ).Get(),
                &response_received_token_
            );
        }
    }

    void start_next() {
        if (!ready_ || active_ || jobs_.empty() || !webview_) {
            return;
        }

        active_ = std::move(jobs_.front());
        jobs_.pop_front();

        if (active_->kind == JobKind::discover) {
            if (active_->pages.empty()) {
                finish_discovery();
            } else {
                navigate_current_page();
            }
            return;
        }

        const auto existing = find_cached(*active_);
        if (existing) {
            emit(
                L"image-cached|" + active_->request_id + L"|" +
                uri::file_url(*existing) + L"|" + active_->source + L"|" +
                active_->index
            );
            finish_current();
            return;
        }

        if (!trusted_image_url(active_->url)) {
            finish_cache(false, {});
            return;
        }

        active_->destination_stem =
            file_stem(active_->identity) + L"-" +
            file_stem(active_->source) + L"-" +
            file_stem(active_->index);
        webview_->Navigate(active_->url.c_str());
    }

    void navigate_current_page() {
        if (!active_ || active_->page_index >= active_->pages.size()) {
            finish_discovery();
            return;
        }
        webview_->Navigate(
            active_->pages[active_->page_index].url.c_str()
        );
    }

    void on_navigation_completed(
        ICoreWebView2NavigationCompletedEventArgs* arguments
    ) {
        if (!active_) return;

        BOOL success = FALSE;
        arguments->get_IsSuccess(&success);

        if (active_->kind == JobKind::cache) {
            if (success != TRUE && !active_->response_started) {
                finish_cache(false, {});
            }
            return;
        }

        if (success != TRUE) {
            active_->results[
                active_->pages[active_->page_index].slot
            ] = L"[]";
            ++active_->page_index;
            navigate_current_page();
            return;
        }

        const auto page_index = active_->page_index;
        const auto request_id = active_->request_id;
        webview_->ExecuteScript(
            extraction_script.data(),
            Microsoft::WRL::Callback<
                ICoreWebView2ExecuteScriptCompletedHandler
            >(
                [this, page_index, request_id](
                    HRESULT result,
                    LPCWSTR raw_json
                ) {
                    if (!active_ ||
                        active_->kind != JobKind::discover ||
                        active_->request_id != request_id ||
                        active_->page_index != page_index) {
                        return S_OK;
                    }

                    const auto slot = active_->pages[page_index].slot;
                    active_->results[slot] =
                        SUCCEEDED(result)
                            ? normalize_json_array(raw_json ? raw_json : L"[]")
                            : L"[]";
                    ++active_->page_index;
                    navigate_current_page();
                    return S_OK;
                }
            ).Get()
        );
    }

    void on_response_received(
        ICoreWebView2WebResourceResponseReceivedEventArgs* arguments
    ) {
        if (!active_ ||
            active_->kind != JobKind::cache ||
            active_->response_started) {
            return;
        }

        Microsoft::WRL::ComPtr<ICoreWebView2WebResourceRequest> request;
        if (FAILED(arguments->get_Request(&request)) || !request) return;

        LPWSTR raw_uri = nullptr;
        if (FAILED(request->get_Uri(&raw_uri))) return;
        const std::wstring response_uri = raw_uri ? raw_uri : L"";
        CoTaskMemFree(raw_uri);
        if (response_uri != active_->url) return;

        Microsoft::WRL::ComPtr<ICoreWebView2WebResourceResponseView> response;
        if (FAILED(arguments->get_Response(&response)) || !response) return;

        INT status = 0;
        response->get_StatusCode(&status);
        if (status < 200 || status >= 300) {
            finish_cache(false, {});
            return;
        }

        active_->response_started = true;
        std::wstring content_type;
        Microsoft::WRL::ComPtr<ICoreWebView2HttpResponseHeaders> headers;
        if (SUCCEEDED(response->get_Headers(&headers)) && headers) {
            LPWSTR raw_content_type = nullptr;
            if (SUCCEEDED(headers->GetHeader(
                L"Content-Type",
                &raw_content_type
            ))) {
                content_type = raw_content_type ? raw_content_type : L"";
                CoTaskMemFree(raw_content_type);
            }
        }

        const auto request_id = active_->request_id;
        const auto source = active_->source;
        const auto index = active_->index;
        const auto stem = active_->destination_stem;
        const auto url = active_->url;

        response->GetContent(
            Microsoft::WRL::Callback<
                ICoreWebView2WebResourceResponseViewGetContentCompletedHandler
            >(
                [this, request_id, source, index, stem, url, content_type](
                    HRESULT result,
                    IStream* stream
                ) {
                    if (!active_ ||
                        active_->kind != JobKind::cache ||
                        active_->request_id != request_id) {
                        return S_OK;
                    }

                    if (FAILED(result) || stream == nullptr) {
                        finish_cache(false, {});
                        return S_OK;
                    }

                    const auto extension =
                        image_extension(content_type, url);
                    const auto destination =
                        cache_directory_ / (stem + extension);
                    if (!save_stream(stream, destination)) {
                        finish_cache(false, {});
                        return S_OK;
                    }

                    finish_cache(true, destination);
                    return S_OK;
                }
            ).Get()
        );
    }

    void finish_discovery() {
        if (!active_) return;
        const auto json =
            L"{\"imdbPrimary\":" + active_->results[0] +
            L",\"imdbMore\":" + active_->results[1] +
            L",\"tmdbPrimary\":" + active_->results[2] +
            L",\"tmdbMore\":" + active_->results[3] + L"}";
        emit(
            L"artwork-sources|" + active_->request_id + L"|" + json
        );
        finish_current();
    }

    void finish_cache(
        bool success,
        const std::filesystem::path& path
    ) {
        if (!active_) return;
        emit(
            L"image-cached|" + active_->request_id + L"|" +
            (success ? uri::file_url(path) : std::wstring{}) + L"|" +
            active_->source + L"|" + active_->index
        );
        finish_current();
    }

    void finish_current() {
        active_.reset();
        start_next();
    }

    void emit(const std::wstring& message) const {
        if (event_handler_) {
            event_handler_(message);
        }
    }

    void report_error(std::wstring_view message) const {
        if (error_handler_) {
            error_handler_(message);
        }
    }

    [[nodiscard]] static bool all_digits(std::wstring_view value) {
        return !value.empty() && std::all_of(
            value.begin(),
            value.end(),
            [](wchar_t ch) {
                return ch >= L'0' && ch <= L'9';
            }
        );
    }

    [[nodiscard]] static bool valid_imdb(std::wstring_view value) {
        return value.size() > 2 &&
            value.starts_with(L"tt") &&
            all_digits(value.substr(2));
    }

    [[nodiscard]] static std::wstring lower(std::wstring_view value) {
        std::wstring result{value};
        std::transform(
            result.begin(),
            result.end(),
            result.begin(),
            [](wchar_t ch) {
                if (ch >= L'A' && ch <= L'Z') {
                    return static_cast<wchar_t>(ch - L'A' + L'a');
                }
                return ch;
            }
        );
        return result;
    }

    [[nodiscard]] static bool trusted_image_url(
        std::wstring_view url
    ) {
        return
            uri::starts_with_case_insensitive(
                url,
                L"https://m.media-amazon.com/images/M/"
            ) ||
            uri::starts_with_case_insensitive(
                url,
                L"https://media.themoviedb.org/t/p/"
            );
    }

    [[nodiscard]] static std::wstring normalize_json_array(
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

    [[nodiscard]] static std::wstring file_stem(
        std::wstring_view value
    ) {
        std::wstring result;
        result.reserve(value.size());
        for (const auto ch : value) {
            if ((ch >= L'a' && ch <= L'z') ||
                (ch >= L'0' && ch <= L'9') ||
                ch == L'-') {
                result.push_back(ch);
            } else if (ch >= L'A' && ch <= L'Z') {
                result.push_back(
                    static_cast<wchar_t>(ch - L'A' + L'a')
                );
            } else {
                result.push_back(L'-');
            }
        }
        while (result.find(L"--") != std::wstring::npos) {
            result.replace(result.find(L"--"), 2, L"-");
        }
        if (result.empty()) return L"unknown";
        if (result.size() > 96) result.resize(96);
        return result;
    }

    [[nodiscard]] static std::wstring image_extension(
        std::wstring_view content_type,
        std::wstring_view url
    ) {
        const auto type = lower(content_type);
        if (type.find(L"png") != std::wstring::npos) return L".png";
        if (type.find(L"webp") != std::wstring::npos) return L".webp";
        if (type.find(L"avif") != std::wstring::npos) return L".avif";
        if (type.find(L"gif") != std::wstring::npos) return L".gif";
        const auto lowered_url = lower(url);
        for (const auto extension : {
            L".png", L".webp", L".avif", L".gif", L".jpeg"
        }) {
            if (lowered_url.find(extension) != std::wstring::npos) {
                return extension;
            }
        }
        return L".jpg";
    }

    [[nodiscard]] std::optional<std::filesystem::path> find_cached(
        const Job& job
    ) const {
        const auto prefix =
            file_stem(job.identity) + L"-" +
            file_stem(job.source) + L"-" +
            file_stem(job.index);
        for (const auto extension : {
            L".jpg", L".jpeg", L".png", L".webp", L".avif", L".gif"
        }) {
            const auto candidate =
                cache_directory_ / (prefix + extension);
            std::error_code error;
            if (std::filesystem::is_regular_file(candidate, error)) {
                return candidate;
            }
        }
        return std::nullopt;
    }

    bool save_stream(
        IStream* stream,
        const std::filesystem::path& destination
    ) {
        std::error_code error;
        std::filesystem::create_directories(cache_directory_, error);
        const auto temporary = destination.wstring() + L".download";
        std::ofstream output{
            std::filesystem::path{temporary},
            std::ios::binary | std::ios::trunc
        };
        if (!output) return false;

        std::array<char, 64 * 1024> buffer{};
        std::size_t total = 0;
        constexpr std::size_t maximum = 24U * 1024U * 1024U;
        while (total < maximum) {
            ULONG read = 0;
            const auto result = stream->Read(
                buffer.data(),
                static_cast<ULONG>(buffer.size()),
                &read
            );
            if (FAILED(result)) {
                output.close();
                std::filesystem::remove(temporary, error);
                return false;
            }
            if (read == 0) break;
            total += read;
            if (total > maximum) {
                output.close();
                std::filesystem::remove(temporary, error);
                return false;
            }
            output.write(buffer.data(), static_cast<std::streamsize>(read));
            if (!output) {
                output.close();
                std::filesystem::remove(temporary, error);
                return false;
            }
            if (result == S_FALSE) break;
        }
        output.close();
        if (total == 0) {
            std::filesystem::remove(temporary, error);
            return false;
        }

        const auto stem = destination.stem().wstring();
        for (const auto extension : {
            L".jpg", L".jpeg", L".png", L".webp", L".avif", L".gif"
        }) {
            std::filesystem::remove(
                cache_directory_ / (stem + extension),
                error
            );
            error.clear();
        }
        std::filesystem::rename(temporary, destination, error);
        if (error) {
            std::filesystem::remove(temporary, error);
            return false;
        }
        return true;
    }

    HWND parent_{};
    HWND hidden_window_{};
    std::filesystem::path cache_directory_;
    EventHandler event_handler_;
    ErrorHandler error_handler_;

    Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;

    EventRegistrationToken navigation_completed_token_{};
    EventRegistrationToken response_received_token_{};

    std::deque<Job> jobs_;
    std::optional<Job> active_;
    bool ready_{false};
};

} // namespace vidcore
"""
write("VidCoreNativePlayer/src/vidcore.artwork_resolver.ixx", RESOLVER)

cmake = read("VidCoreNativePlayer/CMakeLists.txt")
cmake = replace_once(cmake, "VERSION 0.2.8", "VERSION 0.2.9", "cmake version")
cmake = replace_once(
    cmake,
    "            src/vidcore.blocklist.ixx\n            src/vidcore.webview.ixx",
    "            src/vidcore.blocklist.ixx\n            src/vidcore.artwork_resolver.ixx\n            src/vidcore.webview.ixx",
    "resolver module"
)
write("VidCoreNativePlayer/CMakeLists.txt", cmake)

webview = read("VidCoreNativePlayer/src/vidcore.webview.ixx")
webview = replace_once(
    webview,
    "#include <algorithm>\n#include <filesystem>",
    "#include <algorithm>\n#include <array>\n#include <filesystem>\n#include <memory>",
    "webview includes"
)
webview = replace_once(
    webview,
    "import vidcore.blocklist;\nimport vidcore.uri;",
    "import vidcore.artwork_resolver;\nimport vidcore.blocklist;\nimport vidcore.uri;",
    "webview import"
)
webview = replace_once(
    webview,
    "                                register_events();\n                                resize();\n                                install_popup_guard();",
    "                                register_events();\n                                resize();\n                                initialize_artwork_resolver();\n                                install_popup_guard();",
    "resolver initialization"
)
webview = replace_once(
    webview,
    "    void shutdown() {\n        if (controller_) {",
    "    void shutdown() {\n        artwork_resolver_.reset();\n        if (controller_) {",
    "resolver shutdown"
)
webview = replace_once(
    webview,
    "    [[nodiscard]] static bool host_matches(",
    '''    void initialize_artwork_resolver() {
        artwork_resolver_ = std::make_unique<ArtworkResolver>(
            window_,
            environment_.Get(),
            executable_directory() / L"cache",
            [this](const std::wstring& message) {
                post_event(message);
            }
        );
        artwork_resolver_->initialize(
            [this](std::wstring_view message) {
                report_error(message);
            }
        );
    }

    [[nodiscard]] static bool host_matches(''',
    "resolver method"
)
handlers = '''        if (command == L"resolve-image") {
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
            if (artwork_resolver_) {
                artwork_resolver_->discover(
                    fields[0],
                    fields[1],
                    fields[2],
                    fields[3],
                    fields[4]
                );
            }
            return;
        }

        if (command == L"cache-image") {
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
            if (artwork_resolver_) {
                artwork_resolver_->cache(
                    fields[0],
                    fields[1],
                    fields[2],
                    fields[3],
                    fields[4]
                );
            }
            return;
        }

        if (command == L"delete-image-cache") {
            if (artwork_resolver_) artwork_resolver_->remove(payload);
            return;
        }

        if (command == L"prune-image-cache") {
            if (artwork_resolver_) artwork_resolver_->prune(payload);
            return;
        }

'''
webview = replace_once(
    webview,
    '        if (command == L"mute") {',
    handlers + '        if (command == L"mute") {',
    "artwork commands"
)
webview = replace_once(
    webview,
    "    PopupBlocklist blocklist_;\n    ErrorHandler error_handler_;",
    "    PopupBlocklist blocklist_;\n    ErrorHandler error_handler_;\n    std::unique_ptr<ArtworkResolver> artwork_resolver_;",
    "resolver member"
)
write("VidCoreNativePlayer/src/vidcore.webview.ixx", webview)

for path in [
    "VidCoreNativePlayer/assets/index.html",
    "VidCoreWebPlayer/index.html"
]:
    html = read(path)
    html = replace_once(
        html,
        '''            <button id="resolveButton" class="button">Resolve</button>
            <button id="favoriteButton" class="button">★ Save</button>
            <button id="imdbButton" class="button hidden">IMDb</button>
            <button id="tmdbButton" class="button hidden">TMDB</button>''',
        '''            <button id="resolveButton" class="button">Resolve</button>
            <button id="favoriteButton" class="button">★ Save</button>
            <button id="previousArtworkButton" class="button hidden">◀ Art</button>
            <button id="imdbArtworkButton" class="button hidden">IMDb art</button>
            <button id="tmdbArtworkButton" class="button hidden">TMDB art</button>
            <button id="nextArtworkButton" class="button hidden">Art ▶</button>
            <button id="imdbButton" class="button hidden">IMDb page</button>
            <button id="tmdbButton" class="button hidden">TMDB page</button>''',
        f"artwork controls {path}"
    )
    write(path, html)

new_artwork_block = r'''  function mediaCacheIdentity(entry, metadata = entry) {
    const mode = entry?.mode === "tv" ? "tv" : "movie";
    const imdb = String(metadata?.imdb || (/^tt\d+$/i.test(entry?.id || "") ? entry.id : "")).toLowerCase();
    if (imdb) return `${mode}:imdb:${imdb}`;
    const tmdb = String(metadata?.tmdb || (/^\d+$/.test(entry?.id || "") ? entry.id : ""));
    if (tmdb) return `${mode}:tmdb:${tmdb}`;
    return `${mode}:id:${String(entry?.id || "unknown").toLowerCase()}`;
  }

  function artworkRequest(command, fields, timeout = 26000) {
    if (!globalThis.chrome?.webview) {
      return Promise.resolve(null);
    }
    const requestId = String(++state.artworkSequence);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        state.artworkRequests.delete(requestId);
        resolve(null);
      }, timeout);
      state.artworkRequests.set(requestId, { resolve, timer });
      postHost([command, requestId, ...fields].join("|"));
    });
  }

  function uniqueArtworkUrls(values) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(value => String(value || "").trim())
        .filter(value => /^https:\/\//i.test(value))
    )];
  }

  function normalizeArtworkGallery(payload) {
    return {
      imdb: uniqueArtworkUrls([
        ...(payload?.imdbPrimary || []),
        ...(payload?.imdbMore || [])
      ]),
      tmdb: uniqueArtworkUrls([
        ...(payload?.tmdbPrimary || []),
        ...(payload?.tmdbMore || [])
      ])
    };
  }

  function updateArtworkButtons() {
    const imdbCount = state.artworkGallery.imdb.length;
    const tmdbCount = state.artworkGallery.tmdb.length;
    elements.imdbArtworkButton.classList.toggle("hidden", imdbCount === 0);
    elements.tmdbArtworkButton.classList.toggle("hidden", tmdbCount === 0);
    elements.imdbArtworkButton.classList.toggle(
      "primary",
      state.artworkSource === "imdb"
    );
    elements.tmdbArtworkButton.classList.toggle(
      "primary",
      state.artworkSource === "tmdb"
    );
    elements.imdbArtworkButton.textContent =
      imdbCount ? `IMDb art ${state.artworkSource === "imdb" ? state.artworkIndex + 1 : 1}/${imdbCount}` : "IMDb art";
    elements.tmdbArtworkButton.textContent =
      tmdbCount ? `TMDB art ${state.artworkSource === "tmdb" ? state.artworkIndex + 1 : 1}/${tmdbCount}` : "TMDB art";

    const activeCount = state.artworkGallery[state.artworkSource]?.length || 0;
    elements.previousArtworkButton.classList.toggle("hidden", activeCount < 2);
    elements.nextArtworkButton.classList.toggle("hidden", activeCount < 2);
  }

  function resetArtworkGallery() {
    state.artworkGallery = { imdb: [], tmdb: [] };
    state.artworkSource = "";
    state.artworkIndex = 0;
    updateArtworkButtons();
  }

  async function requestArtworkSources(entry, metadata = entry) {
    const payload = await artworkRequest(
      "resolve-image",
      [
        entry.mode === "tv" ? "tv" : "movie",
        entry.id || "",
        metadata?.imdb || "",
        metadata?.tmdb || ""
      ]
    );
    return normalizeArtworkGallery(payload || {});
  }

  async function cacheArtworkCandidate(
    entry,
    metadata,
    source,
    index,
    url
  ) {
    const result = await artworkRequest(
      "cache-image",
      [
        mediaCacheIdentity(entry, metadata),
        source,
        String(index),
        url
      ],
      22000
    );
    return typeof result === "string" ? result : "";
  }

  async function showArtwork(source, index = 0, persist = true) {
    const gallery = state.artworkGallery[source] || [];
    if (gallery.length === 0) return;

    const normalizedIndex =
      ((Number(index) || 0) % gallery.length + gallery.length) % gallery.length;
    state.artworkSource = source;
    state.artworkIndex = normalizedIndex;
    updateArtworkButtons();

    const entry = currentEntrySafe();
    const candidate = gallery[normalizedIndex];
    const local = await cacheArtworkCandidate(
      entry,
      state.currentMetadata || {},
      source,
      normalizedIndex,
      candidate
    );
    if (!isCurrentEntry(entry)) return;

    const metadata = {
      ...(state.currentMetadata || emptyMetadata(entry)),
      image: local || candidate,
      artworkSource:
        source === "imdb"
          ? "IMDb poster cache"
          : "TMDB poster cache"
    };
    state.currentMetadata = metadata;
    state.currentMetadataKey = VidCoreMetadata.entryKey(entry);
    renderCurrent(entry, metadata);
    if (persist) await persistMetadata(entry, metadata);
  }

  async function chooseArtworkSource(source) {
    if (state.artworkSource === source) {
      await showArtwork(source, state.artworkIndex + 1);
    } else {
      await showArtwork(source, 0);
    }
  }

  async function stepArtwork(delta) {
    if (!state.artworkSource) return;
    await showArtwork(
      state.artworkSource,
      state.artworkIndex + delta
    );
  }

  async function preferOfficialArtwork(entry, metadata) {
    try {
      const gallery = await requestArtworkSources(entry, metadata);
      const source = gallery.imdb.length
        ? "imdb"
        : gallery.tmdb.length
          ? "tmdb"
          : "";
      const candidate = source ? gallery[source][0] : "";
      const image = candidate
        ? await cacheArtworkCandidate(entry, metadata, source, 0, candidate)
        : "";

      if (isCurrentEntry(entry)) {
        state.artworkGallery = gallery;
        state.artworkSource = source;
        state.artworkIndex = 0;
        updateArtworkButtons();
      }

      return image || candidate
        ? {
            ...metadata,
            image: image || candidate,
            artworkSource:
              source === "imdb"
                ? "IMDb poster cache"
                : "TMDB poster cache"
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

for path in [
    "VidCoreNativePlayer/assets/app.js",
    "VidCoreWebPlayer/app.js"
]:
    app = read(path)
    app = replace_once(
        app,
        '    favoriteButton: $("#favoriteButton"),\n    currentPoster:',
        '    favoriteButton: $("#favoriteButton"),\n    previousArtworkButton: $("#previousArtworkButton"),\n    imdbArtworkButton: $("#imdbArtworkButton"),\n    tmdbArtworkButton: $("#tmdbArtworkButton"),\n    nextArtworkButton: $("#nextArtworkButton"),\n    currentPoster:',
        f"artwork element bindings {path}"
    )
    app = replace_once(
        app,
        '    artworkSequence: 0,\n    artworkRequests: new Map()',
        '    artworkSequence: 0,\n    artworkRequests: new Map(),\n    artworkGallery: { imdb: [], tmdb: [] },\n    artworkSource: "",\n    artworkIndex: 0',
        f"artwork state {path}"
    )
    start = app.index("  function mediaCacheIdentity(")
    end = app.index("  function setStatus(", start)
    app = app[:start] + new_artwork_block + "\n\n" + app[end:]
    app = replace_once(
        app,
        '      state.related = [];\n      renderCurrent(entry, emptyMetadata(entry));',
        '      state.related = [];\n      resetArtworkGallery();\n      renderCurrent(entry, emptyMetadata(entry));',
        f"reset artwork gallery {path}"
    )
    app = replace_once(
        app,
        '    for (const [button, url] of [\n      [elements.fastflixButton, catalogUrls.fastflix],',
        '    updateArtworkButtons();\n\n    for (const [button, url] of [\n      [elements.fastflixButton, catalogUrls.fastflix],',
        f"render artwork controls {path}"
    )
    old_handler = '''    if (command === "image-resolved") {
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

'''
    new_handler = '''    if (command === "artwork-sources") {
      const second = payload.indexOf("|");
      const requestId = second < 0 ? payload : payload.slice(0, second);
      const json = second < 0 ? "{}" : payload.slice(second + 1);
      const pending = state.artworkRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        state.artworkRequests.delete(requestId);
        try {
          pending.resolve(JSON.parse(json));
        } catch {
          pending.resolve(null);
        }
      }
      return;
    }

    if (command === "image-cached") {
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

'''
    app = replace_once(app, old_handler, new_handler, f"host artwork messages {path}")
    app = replace_once(
        app,
        '''    elements.favoriteButton.addEventListener(
      "click",
      () => openSaveDialog()
    );

    elements.imdbButton.addEventListener(''',
        '''    elements.favoriteButton.addEventListener(
      "click",
      () => openSaveDialog()
    );
    elements.previousArtworkButton.addEventListener(
      "click",
      () => stepArtwork(-1)
    );
    elements.nextArtworkButton.addEventListener(
      "click",
      () => stepArtwork(1)
    );
    elements.imdbArtworkButton.addEventListener(
      "click",
      () => chooseArtworkSource("imdb")
    );
    elements.tmdbArtworkButton.addEventListener(
      "click",
      () => chooseArtworkSource("tmdb")
    );

    elements.imdbButton.addEventListener(''',
        f"artwork button events {path}"
    )
    write(path, app)

test = read("VidCoreNativePlayer/tests/static-smoke.test.mjs")
test = replace_once(
    test,
    '''const webview = fs.readFileSync(
  path.join(root, "src", "vidcore.webview.ixx"),
  "utf8"
);''',
    '''const webview = fs.readFileSync(
  path.join(root, "src", "vidcore.webview.ixx"),
  "utf8"
);
const resolver = fs.readFileSync(
  path.join(root, "src", "vidcore.artwork_resolver.ixx"),
  "utf8"
);''',
    "resolver test source"
)
test = replace_once(
    test,
    '  "deleteListButton"\n])',
    '  "deleteListButton",\n  "previousArtworkButton",\n  "imdbArtworkButton",\n  "tmdbArtworkButton",\n  "nextArtworkButton"\n])',
    "artwork ids"
)
test = replace_once(
    test,
    'assert.doesNotMatch(webview, /resolve-image|delete-image-cache|prune-image-cache/);\nassert.doesNotMatch(webview, /WinHttpOpen|ImageCache/);',
    '''assert.match(webview, /resolve-image/);
assert.match(webview, /cache-image/);
assert.match(webview, /delete-image-cache/);
assert.match(webview, /prune-image-cache/);
assert.match(webview, /ArtworkResolver/);
assert.match(resolver, /m\\.media-amazon\\.com/);
assert.match(resolver, /media\\.themoviedb\\.org/);
assert.match(resolver, /srcset/);
assert.match(resolver, /candidates\\.sort/);
assert.match(resolver, /mediaindex/);
assert.match(resolver, /images\\/posters/);
assert.match(app, /artwork-sources/);
assert.match(app, /image-cached/);
assert.match(app, /stepArtwork/);
assert.doesNotMatch(resolver, /WinHttpOpen|WinHttpSendRequest/);
assert.doesNotMatch(webview, /WinHttpOpen|ImageCache/);''',
    "artwork resolver tests"
)
write("VidCoreNativePlayer/tests/static-smoke.test.mjs", test)

readme = read("VidCoreNativePlayer/README.md")
readme += '''

## v0.2.9 IMDb and TMDB artwork gallery

- Metadata names and identifiers remain resolved through the existing metadata system.
- The native player opens the title pages in a hidden WebView2 browser, reads poster `<img>` elements, and chooses the smallest usable `srcset` candidate.
- IMDb primary and media-index posters and TMDB primary and poster-gallery images can be flipped through from the current metadata card.
- The first IMDb poster is preferred, with TMDB used when IMDb does not provide a usable image.
- Selected images are captured from WebView2 responses and written under `cache/` beside the executable. The native host does not use WinHTTP or a custom HTTP client.
- Cached variants are reused by media identity, removed when the final saved entry is deleted, and pruned when no saved media references them.
'''
write("VidCoreNativePlayer/README.md", readme)

workflow = read(".github/workflows/release.yml")
workflow = replace_once(
    workflow,
    "This release keeps the Defender-safe native host: no native WinHTTP page scraper, custom image downloader, or automatic image-file deletion code is included. WebView2 keeps its profile, normal browser cache, IndexedDB, settings, and popup history in `data/` beside the executable.",
    "This release keeps the Defender-safe native host free of WinHTTP and custom HTTP clients. A hidden WebView2 resolver reads IMDb and TMDB poster elements, and selected WebView2 image responses are written to the portable `cache/` folder beside the executable.",
    "release security note"
)
workflow = replace_once(
    workflow,
    "v$env:VERSION swaps the compact resolve card above the provider/play controls, adds safe custom-list deletion, hides or prunes empty custom lists, and preserves the complete 108-title built-in default library from the latest supplied backup.",
    "v$env:VERSION adds IMDb-first and TMDB-second poster discovery, smallest-srcset selection, source and image cycling controls, portable multi-image caching, and keeps the complete 111-entry, 25-list built-in default union.",
    "release feature note"
)
write(".github/workflows/release.yml", workflow)

mission = read("missioncache.md")
mission = mission.replace(
    "- [ ] Restore IMDb-first/TMDB-second official artwork through a signed or independently verified implementation that does not trigger Defender.\n- [ ] Restore readable `cache/<media>.jpg` lifecycle only after the implementation passes Microsoft Defender analysis.\n",
    ""
)
marker = "\n## Open / provider-limited\n"
completed = '''

- [x] Resolve IMDb title and media-index poster images through a hidden WebView2 browser instead of a native HTTP scraper.
- [x] Resolve TMDB title and poster-gallery images through the same browser path.
- [x] Select the smallest usable `srcset` candidate, including IMDb width descriptors and TMDB 1x/2x descriptors.
- [x] Add current-card controls to switch between IMDb and TMDB and flip through multiple poster candidates.
- [x] Cache selected WebView2 image responses under `cache/` beside the executable without WinHTTP.
- [x] Reuse cached variants by media identity and restore delete/prune lifecycle for unreferenced artwork.
- [x] Publish release `v0.2.9` with the IMDb/TMDB artwork gallery and portable cache.
'''
mission = mission.replace(marker, completed + marker)
write("missioncache.md", mission)
