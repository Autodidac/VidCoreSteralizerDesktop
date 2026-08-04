module;

#include <algorithm>
#include <cwctype>
#include <filesystem>
#include <ranges>
#include <string>
#include <string_view>
#include <vector>
#include <windows.h>
#include <shlwapi.h>

export module vidcore.uri;

export namespace vidcore::uri {

[[nodiscard]] inline std::wstring lowercase(std::wstring value) {
    std::ranges::transform(
        value,
        value.begin(),
        [](const wchar_t character) {
            return static_cast<wchar_t>(std::towlower(character));
        }
    );
    return value;
}

[[nodiscard]] inline std::wstring host_from_url(std::wstring_view url) {
    const auto scheme = url.find(L"://");
    if (scheme == std::wstring_view::npos) {
        return {};
    }

    auto begin = scheme + 3;
    const auto credentials = url.find(L'@', begin);
    const auto path = url.find_first_of(L"/?#", begin);

    if (credentials != std::wstring_view::npos &&
        (path == std::wstring_view::npos || credentials < path)) {
        begin = credentials + 1;
    }

    auto end = url.find_first_of(L"/?#", begin);
    if (end == std::wstring_view::npos) {
        end = url.size();
    }

    const auto port = url.find(L':', begin);
    if (port != std::wstring_view::npos && port < end) {
        end = port;
    }

    if (end <= begin) {
        return {};
    }

    return lowercase(std::wstring{url.substr(begin, end - begin)});
}

[[nodiscard]] inline std::wstring file_url(const std::filesystem::path& path) {
    const auto absolute_path = std::filesystem::absolute(path).wstring();
    std::vector<wchar_t> buffer(32'768, L'\0');
    auto length = static_cast<DWORD>(buffer.size());

    const auto result = UrlCreateFromPathW(
        absolute_path.c_str(),
        buffer.data(),
        &length,
        0
    );

    if (FAILED(result)) {
        return L"file:///" + std::filesystem::absolute(path).generic_wstring();
    }

    return std::wstring{buffer.data()};
}

[[nodiscard]] inline bool starts_with_case_insensitive(
    std::wstring_view value,
    std::wstring_view prefix
) {
    if (value.size() < prefix.size()) {
        return false;
    }

    for (std::size_t index = 0; index < prefix.size(); ++index) {
        if (std::towlower(value[index]) != std::towlower(prefix[index])) {
            return false;
        }
    }

    return true;
}

[[nodiscard]] inline std::wstring trim(std::wstring value) {
    const auto not_space = [](const wchar_t character) {
        return std::iswspace(character) == 0;
    };

    const auto first = std::ranges::find_if(value, not_space);
    const auto last = std::ranges::find_if(value | std::views::reverse, not_space).base();

    if (first >= last) {
        return {};
    }

    return std::wstring{first, last};
}

} // namespace vidcore::uri
