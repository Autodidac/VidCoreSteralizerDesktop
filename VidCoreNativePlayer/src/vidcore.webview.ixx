module;

#include <algorithm>
#include <filesystem>
#include <functional>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>
#include <windows.h>
#include <objbase.h>
#include <shellapi.h>
#include <wrl.h>
#include <WebView2.h>

export module vidcore.webview;

import vidcore.blocklist;
import vidcore.uri;

export namespace vidcore {

class WebViewHost final {
public:
    using ErrorHandler = std::function<void(std::wstring_view)>;

    explicit WebViewHost(HWND window)
        : window_{window},
          assets_index_{std::filesystem::current_path() / L"assets" / L"index.html"},
          home_url_{uri::file_url(assets_index_)} {}

    WebViewHost(const WebViewHost&) = delete;
    WebViewHost& operator=(const WebViewHost&) = delete;

    ~WebViewHost() {
        shutdown();
    }

    void initialize(ErrorHandler error_handler) {
        error_handler_ = std::move(error_handler);

        const auto user_data = blocklist_.directory() / L"WebView2";
        std::error_code error;
        std::filesystem::create_directories(user_data, error);

        const auto result = CreateCoreWebView2EnvironmentWithOptions(
            nullptr,
            user_data.c_str(),
            nullptr,
            Microsoft::WRL::Callback<
                ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler
            >(
                [this](HRESULT environment_result, ICoreWebView2Environment* environment) {
                    if (FAILED(environment_result) || environment == nullptr) {
                        report_error(L"WebView2 environment creation failed. Install the Microsoft Edge WebView2 Runtime.");
                        return environment_result;
                    }

                    environment_ = environment;

                    return environment_->CreateCoreWebView2Controller(
                        window_,
                        Microsoft::WRL::Callback<
                            ICoreWebView2CreateCoreWebView2ControllerCompletedHandler
                        >(
                            [this](HRESULT controller_result, ICoreWebView2Controller* controller) {
                                if (FAILED(controller_result) || controller == nullptr) {
                                    report_error(L"WebView2 controller creation failed.");
                                    return controller_result;
                                }

                                controller_ = controller;
                                controller_->get_CoreWebView2(&webview_);

                                if (!webview_) {
                                    report_error(L"WebView2 did not return a browser instance.");
                                    return E_POINTER;
                                }

                                configure_settings();
                                register_events();
                                resize();
                                install_popup_guard();
                                return S_OK;
                            }
                        ).Get()
                    );
                }
            ).Get()
        );

        if (FAILED(result)) {
            report_error(L"Unable to start WebView2.");
        }
    }

    void resize() const {
        if (!controller_) {
            return;
        }

        RECT bounds{};
        GetClientRect(window_, &bounds);
        controller_->put_Bounds(bounds);
    }

    void shutdown() {
        if (controller_) {
            controller_->Close();
        }

        webview_.Reset();
        controller_.Reset();
        environment_.Reset();
    }

private:
    static constexpr std::wstring_view popup_guard_script = LR"JS(
(() => {
    if (globalThis.__vidcorePopupGuardInstalled) {
        return;
    }

    globalThis.__vidcorePopupGuardInstalled = true;

    const report = (kind, value) => {
        try {
            globalThis.chrome?.webview?.postMessage(
                `blocked|${kind}|${String(value ?? "")}`
            );
        } catch {
        }
    };

    const originalOpen = globalThis.open?.bind(globalThis);
    globalThis.open = (url, target, features) => {
        report("window.open", url);
        return null;
    };

    const externalTarget = (raw) => {
        try {
            const value = new URL(raw, location.href);
            return /^https?:$/.test(value.protocol) && value.host !== location.host;
        } catch {
            return false;
        }
    };

    addEventListener("click", (event) => {
        const anchor = event.target?.closest?.("a[href]");
        if (!anchor || anchor.hasAttribute("data-vidcore-allow")) {
            return;
        }

        const target = String(anchor.target || "").toLowerCase();
        if (target === "_blank" || externalTarget(anchor.href)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            report(target === "_blank" ? "target-blank" : "external-click", anchor.href);
        }
    }, true);

    addEventListener("auxclick", (event) => {
        const anchor = event.target?.closest?.("a[href]");
        if (!anchor || anchor.hasAttribute("data-vidcore-allow")) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        report("aux-click", anchor.href);
    }, true);

    addEventListener("submit", (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const target = String(form.target || "").toLowerCase();
        const action = form.action || location.href;
        if (target === "_blank" || externalTarget(action)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            report("form-navigation", action);
        }
    }, true);
})();
)JS";

    void configure_settings() {
        Microsoft::WRL::ComPtr<ICoreWebView2Settings> settings;
        if (SUCCEEDED(webview_->get_Settings(&settings)) && settings) {
            settings->put_IsScriptEnabled(TRUE);
            settings->put_AreDefaultScriptDialogsEnabled(FALSE);
            settings->put_IsStatusBarEnabled(FALSE);
            settings->put_AreDevToolsEnabled(TRUE);
            settings->put_AreDefaultContextMenusEnabled(TRUE);
        }

        Microsoft::WRL::ComPtr<ICoreWebView2Controller2> controller2;
        if (SUCCEEDED(controller_.As(&controller2)) && controller2) {
            COREWEBVIEW2_COLOR transparent{0, 0, 0, 0};
            controller2->put_DefaultBackgroundColor(transparent);
        }
    }

    void register_events() {
        webview_->add_NewWindowRequested(
            Microsoft::WRL::Callback<ICoreWebView2NewWindowRequestedEventHandler>(
                [this](
                    ICoreWebView2*,
                    ICoreWebView2NewWindowRequestedEventArgs* arguments
                ) {
                    LPWSTR raw_uri = nullptr;
                    arguments->get_Uri(&raw_uri);
                    const std::wstring blocked = raw_uri ? raw_uri : L"unknown";
                    CoTaskMemFree(raw_uri);

                    arguments->put_Handled(TRUE);
                    record_blocked(L"new-window", blocked);
                    return S_OK;
                }
            ).Get(),
            &new_window_token_
        );

        webview_->add_NavigationStarting(
            Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>(
                [this](
                    ICoreWebView2*,
                    ICoreWebView2NavigationStartingEventArgs* arguments
                ) {
                    LPWSTR raw_uri = nullptr;
                    arguments->get_Uri(&raw_uri);
                    const std::wstring target = raw_uri ? raw_uri : L"";
                    CoTaskMemFree(raw_uri);

                    if (shell_loaded_ &&
                        !uri::starts_with_case_insensitive(target, home_url_) &&
                        !uri::starts_with_case_insensitive(target, L"about:blank")) {
                        arguments->put_Cancel(TRUE);
                        record_blocked(L"top-navigation", target);
                    }

                    return S_OK;
                }
            ).Get(),
            &navigation_starting_token_
        );

        webview_->add_NavigationCompleted(
            Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>(
                [this](
                    ICoreWebView2*,
                    ICoreWebView2NavigationCompletedEventArgs* arguments
                ) {
                    BOOL success = FALSE;
                    arguments->get_IsSuccess(&success);
                    shell_loaded_ = success == TRUE;
                    return S_OK;
                }
            ).Get(),
            &navigation_completed_token_
        );

        webview_->add_WebMessageReceived(
            Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                [this](
                    ICoreWebView2*,
                    ICoreWebView2WebMessageReceivedEventArgs* arguments
                ) {
                    LPWSTR raw_message = nullptr;
                    if (FAILED(arguments->TryGetWebMessageAsString(&raw_message))) {
                        return S_OK;
                    }

                    const std::wstring message = raw_message ? raw_message : L"";
                    CoTaskMemFree(raw_message);
                    handle_message(message);
                    return S_OK;
                }
            ).Get(),
            &web_message_token_
        );
    }

    void install_popup_guard() {
        webview_->AddScriptToExecuteOnDocumentCreated(
            popup_guard_script.data(),
            Microsoft::WRL::Callback<
                ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler
            >(
                [this](HRESULT result, LPCWSTR) {
                    if (FAILED(result)) {
                        report_error(L"Popup-guard script injection failed.");
                        return result;
                    }

                    return webview_->Navigate(home_url_.c_str());
                }
            ).Get()
        );
    }

    [[nodiscard]] static bool host_matches(
        std::wstring_view host,
        std::wstring_view domain
    ) {
        return host == domain ||
            (
                host.size() > domain.size() &&
                host.ends_with(domain) &&
                host[host.size() - domain.size() - 1] == L'.'
            );
    }

    [[nodiscard]] static bool trusted_external_url(
        std::wstring_view target
    ) {
        if (!uri::starts_with_case_insensitive(target, L"https://")) {
            return false;
        }

        const auto host = uri::host_from_url(target);
        return
            host_matches(host, L"imdb.com") ||
            host_matches(host, L"themoviedb.org") ||
            host_matches(host, L"wikipedia.org") ||
            host_matches(host, L"wikidata.org");
    }

    void handle_message(const std::wstring& message) {
        const auto separator = message.find(L'|');
        const auto command = message.substr(0, separator);
        const auto payload = separator == std::wstring::npos
            ? std::wstring{}
            : message.substr(separator + 1);

        if (command == L"ready") {
            post_event(L"blocked-count|" + std::to_wstring(blocklist_.size()));
            post_event(L"zoom|1.00");
            post_event(L"muted|0");
            return;
        }

        if (command == L"blocked") {
            const auto next = payload.find(L'|');
            const auto kind = payload.substr(0, next);
            const auto target = next == std::wstring::npos
                ? std::wstring{}
                : payload.substr(next + 1);
            record_blocked(kind, target);
            return;
        }

        if (command == L"mute") {
            const bool mute = payload == L"1";
            Microsoft::WRL::ComPtr<ICoreWebView2_8> media;
            if (SUCCEEDED(webview_.As(&media)) && media) {
                media->put_IsMuted(mute ? TRUE : FALSE);
                post_event(std::wstring{L"muted|"} + (mute ? L"1" : L"0"));
            }
            return;
        }

        if (command == L"zoom") {
            try {
                const auto requested = std::stod(payload);
                const auto zoom = std::clamp(requested, 0.50, 2.00);
                controller_->put_ZoomFactor(zoom);
                post_event(L"zoom|" + std::to_wstring(zoom));
            } catch (...) {
            }
            return;
        }

        if (command == L"devtools") {
            webview_->OpenDevToolsWindow();
            return;
        }

        if (command == L"reload-shell") {
            webview_->Reload();
            return;
        }

        if (command == L"stop-shell") {
            webview_->Stop();
            return;
        }

        if (command == L"open-external") {
            if (!trusted_external_url(payload)) {
                post_event(L"external-denied|" + payload);
                return;
            }

            const auto result = reinterpret_cast<INT_PTR>(
                ShellExecuteW(
                    window_,
                    L"open",
                    payload.c_str(),
                    nullptr,
                    nullptr,
                    SW_SHOWNORMAL
                )
            );

            if (result <= 32) {
                post_event(L"external-denied|" + payload);
            }
            return;
        }

        if (command == L"clear-blocklist") {
            blocklist_.clear();
            post_event(L"blocked-count|0");
            post_event(L"blocked-cleared|");
            return;
        }

        if (command == L"open-data-folder") {
            ShellExecuteW(
                window_,
                L"open",
                blocklist_.directory().c_str(),
                nullptr,
                nullptr,
                SW_SHOWNORMAL
            );
        }
    }

    void record_blocked(
        std::wstring_view kind,
        const std::wstring& target
    ) {
        blocklist_.add_url(target);

        std::wstring event{L"blocked|"};
        event.append(kind);
        event.push_back(L'|');
        event.append(target);
        post_event(event);
        post_event(L"blocked-count|" + std::to_wstring(blocklist_.size()));
    }

    void post_event(const std::wstring& message) const {
        if (webview_) {
            webview_->PostWebMessageAsString(message.c_str());
        }
    }

    void report_error(std::wstring_view message) const {
        if (error_handler_) {
            error_handler_(message);
        }
    }

    HWND window_{};
    std::filesystem::path assets_index_;
    std::wstring home_url_;
    PopupBlocklist blocklist_;
    ErrorHandler error_handler_;

    Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;

    EventRegistrationToken new_window_token_{};
    EventRegistrationToken navigation_starting_token_{};
    EventRegistrationToken navigation_completed_token_{};
    EventRegistrationToken web_message_token_{};

    bool shell_loaded_{false};
};

} // namespace vidcore
