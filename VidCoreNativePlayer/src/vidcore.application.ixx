module;

#include <memory>
#include <string>
#include <string_view>
#include <windows.h>
#include <objbase.h>
#include <dwmapi.h>

export module vidcore.application;

import vidcore.config;
import vidcore.webview;

export namespace vidcore {

class Application final {
public:
    int run(HINSTANCE instance, int show_command) {
        instance_ = instance;

        if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) {
            MessageBoxW(
                nullptr,
                L"COM initialization failed.",
                config::application_name.data(),
                MB_OK | MB_ICONERROR
            );
            return 1;
        }

        if (!register_window_class()) {
            CoUninitialize();
            return 1;
        }

        window_ = CreateWindowExW(
            0,
            config::window_class_name.data(),
            config::application_name.data(),
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            config::initial_width,
            config::initial_height,
            nullptr,
            nullptr,
            instance_,
            this
        );

        if (window_ == nullptr) {
            CoUninitialize();
            return 1;
        }

        apply_modern_window_attributes();

        ShowWindow(window_, show_command);
        UpdateWindow(window_);

        webview_ = std::make_unique<WebViewHost>(window_);
        webview_->initialize(
            [this](const std::wstring_view message) {
                MessageBoxW(
                    window_,
                    std::wstring{message}.c_str(),
                    config::application_name.data(),
                    MB_OK | MB_ICONERROR
                );
            }
        );

        MSG message{};
        while (GetMessageW(&message, nullptr, 0, 0) > 0) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }

        webview_.reset();
        CoUninitialize();
        return static_cast<int>(message.wParam);
    }

private:
    bool register_window_class() const {
        WNDCLASSEXW window_class{
            .cbSize = sizeof(WNDCLASSEXW),
            .style = CS_HREDRAW | CS_VREDRAW,
            .lpfnWndProc = &Application::window_procedure,
            .cbClsExtra = 0,
            .cbWndExtra = 0,
            .hInstance = instance_,
            .hIcon = LoadIconW(nullptr, IDI_APPLICATION),
            .hCursor = LoadCursorW(nullptr, IDC_ARROW),
            .hbrBackground = reinterpret_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)),
            .lpszMenuName = nullptr,
            .lpszClassName = config::window_class_name.data(),
            .hIconSm = LoadIconW(nullptr, IDI_APPLICATION)
        };

        return RegisterClassExW(&window_class) != 0;
    }

    void apply_modern_window_attributes() const {
        const BOOL dark_mode = TRUE;
        DwmSetWindowAttribute(
            window_,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode,
            sizeof(dark_mode)
        );

        const DWM_WINDOW_CORNER_PREFERENCE corners = DWMWCP_ROUND;
        DwmSetWindowAttribute(
            window_,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corners,
            sizeof(corners)
        );
    }

    static LRESULT CALLBACK window_procedure(
        HWND window,
        UINT message,
        WPARAM wparam,
        LPARAM lparam
    ) {
        Application* application = nullptr;

        if (message == WM_NCCREATE) {
            const auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
            application = static_cast<Application*>(create->lpCreateParams);
            SetWindowLongPtrW(
                window,
                GWLP_USERDATA,
                reinterpret_cast<LONG_PTR>(application)
            );
        } else {
            application = reinterpret_cast<Application*>(
                GetWindowLongPtrW(window, GWLP_USERDATA)
            );
        }

        if (application != nullptr) {
            return application->handle_message(window, message, wparam, lparam);
        }

        return DefWindowProcW(window, message, wparam, lparam);
    }

    LRESULT handle_message(
        HWND window,
        UINT message,
        WPARAM wparam,
        LPARAM lparam
    ) {
        switch (message) {
        case WM_SIZE:
            if (webview_) {
                webview_->resize();
            }
            return 0;

        case WM_DPICHANGED: {
            const auto* suggested = reinterpret_cast<RECT*>(lparam);
            SetWindowPos(
                window,
                nullptr,
                suggested->left,
                suggested->top,
                suggested->right - suggested->left,
                suggested->bottom - suggested->top,
                SWP_NOZORDER | SWP_NOACTIVATE
            );
            return 0;
        }

        case WM_GETMINMAXINFO: {
            auto* info = reinterpret_cast<MINMAXINFO*>(lparam);
            info->ptMinTrackSize.x = config::minimum_width;
            info->ptMinTrackSize.y = config::minimum_height;
            return 0;
        }

        case WM_ERASEBKGND:
            return 1;

        case WM_CLOSE:
            DestroyWindow(window);
            return 0;

        case WM_DESTROY:
            if (webview_) {
                webview_->shutdown();
            }
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProcW(window, message, wparam, lparam);
        }
    }

    HINSTANCE instance_{};
    HWND window_{};
    std::unique_ptr<WebViewHost> webview_;
};

} // namespace vidcore
