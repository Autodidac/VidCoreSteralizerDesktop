module;

#include <filesystem>
#include <fstream>
#include <set>
#include <string>
#include <string_view>
#include <system_error>
#include <vector>
#include <windows.h>
#include <objbase.h>
#include <shlobj.h>

export module vidcore.blocklist;

import vidcore.uri;

export namespace vidcore {

class PopupBlocklist final {
public:
    PopupBlocklist()
        : directory_{resolve_directory()},
          file_{directory_ / L"blocked-hosts.txt"} {
        std::error_code error;
        std::filesystem::create_directories(directory_, error);
        load();
    }

    [[nodiscard]] static std::filesystem::path resolve_directory() {
        std::wstring module_path(32768, L'\0');
        const auto length = GetModuleFileNameW(
            nullptr,
            module_path.data(),
            static_cast<DWORD>(module_path.size())
        );

        std::filesystem::path executable_directory;
        if (length > 0 && length < module_path.size()) {
            module_path.resize(length);
            executable_directory = std::filesystem::path{module_path}.parent_path();
        } else {
            executable_directory = std::filesystem::current_path();
        }

        return executable_directory / L"data";
    }

    [[nodiscard]] const std::filesystem::path& directory() const noexcept {
        return directory_;
    }

    [[nodiscard]] std::size_t size() const noexcept {
        return hosts_.size();
    }

    [[nodiscard]] std::vector<std::wstring> hosts() const {
        return {hosts_.begin(), hosts_.end()};
    }

    bool add_url(std::wstring_view value) {
        auto host = uri::host_from_url(value);
        if (host.empty()) {
            return false;
        }

        const auto [_, inserted] = hosts_.insert(std::move(host));
        if (inserted) {
            save();
        }
        return inserted;
    }

    void clear() {
        hosts_.clear();
        save();
    }

private:
    void load() {
        std::wifstream input{file_};
        std::wstring line;

        while (std::getline(input, line)) {
            line = uri::trim(std::move(line));
            if (!line.empty()) {
                hosts_.insert(uri::lowercase(std::move(line)));
            }
        }
    }

    void save() const {
        std::error_code error;
        std::filesystem::create_directories(directory_, error);

        const auto temporary = file_.wstring() + L".tmp";
        {
            std::wofstream output{temporary, std::ios::trunc};
            for (const auto& host : hosts_) {
                output << host << L'\n';
            }
        }

        std::filesystem::remove(file_, error);
        error.clear();
        std::filesystem::rename(temporary, file_, error);
        if (error) {
            std::filesystem::copy_file(
                temporary,
                file_,
                std::filesystem::copy_options::overwrite_existing,
                error
            );
            std::filesystem::remove(temporary, error);
        }
    }

    std::filesystem::path directory_;
    std::filesystem::path file_;
    std::set<std::wstring, std::less<>> hosts_;
};

} // namespace vidcore
