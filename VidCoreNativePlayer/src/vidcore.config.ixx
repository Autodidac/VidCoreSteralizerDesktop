module;

#include <string_view>

export module vidcore.config;

export namespace vidcore::config {

inline constexpr std::wstring_view application_name = L"VidCore Native Player";
inline constexpr std::wstring_view window_class_name = L"VidCoreNativePlayerWindow";
inline constexpr std::wstring_view default_provider = L"https://vidcore.net";
inline constexpr std::wstring_view version = L"0.2.5";

inline constexpr int initial_width = 1600;
inline constexpr int initial_height = 1000;
inline constexpr int minimum_width = 980;
inline constexpr int minimum_height = 680;

} // namespace vidcore::config
