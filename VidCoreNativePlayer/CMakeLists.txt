cmake_minimum_required(VERSION 3.28)

project(
    VidCoreNativePlayer
    VERSION 0.2.6
    DESCRIPTION "C++23 modular WebView2 streaming player with native popup interception"
    LANGUAGES CXX
)

if(NOT WIN32 OR NOT MSVC)
    message(FATAL_ERROR "VidCoreNativePlayer currently targets 64-bit Windows with MSVC.")
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_CXX_SCAN_FOR_MODULES ON)

set(WEBVIEW2_VERSION "1.0.4078.44" CACHE STRING "Microsoft.Web.WebView2 NuGet version")
set(
    WEBVIEW2_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/external/Microsoft.Web.WebView2.${WEBVIEW2_VERSION}"
    CACHE PATH
    "Extracted Microsoft.Web.WebView2 NuGet package"
)

if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(WEBVIEW2_ARCH x64)
else()
    set(WEBVIEW2_ARCH x86)
endif()

set(WEBVIEW2_INCLUDE_DIR "${WEBVIEW2_ROOT}/build/native/include")
set(
    WEBVIEW2_STATIC_LOADER
    "${WEBVIEW2_ROOT}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib"
)

if(NOT EXISTS "${WEBVIEW2_INCLUDE_DIR}/WebView2.h")
    message(
        FATAL_ERROR
        "WebView2 SDK is missing. Run build.bat so scripts/bootstrap.ps1 can download it."
    )
endif()

if(NOT EXISTS "${WEBVIEW2_STATIC_LOADER}")
    message(
        FATAL_ERROR
        "WebView2 static loader is missing at ${WEBVIEW2_STATIC_LOADER}."
    )
endif()

add_executable(VidCoreNativePlayer WIN32)

target_sources(
    VidCoreNativePlayer
    PRIVATE
        src/main.cpp
    PRIVATE
        FILE_SET cxx_modules TYPE CXX_MODULES FILES
            src/vidcore.config.ixx
            src/vidcore.uri.ixx
            src/vidcore.blocklist.ixx
            src/vidcore.image_cache.ixx
            src/vidcore.webview.ixx
            src/vidcore.application.ixx
)

target_include_directories(
    VidCoreNativePlayer
    PRIVATE
        "${WEBVIEW2_INCLUDE_DIR}"
)

target_compile_definitions(
    VidCoreNativePlayer
    PRIVATE
        UNICODE
        _UNICODE
        NOMINMAX
        WIN32_LEAN_AND_MEAN
)

target_compile_options(
    VidCoreNativePlayer
    PRIVATE
        /W4
        /permissive-
        /EHsc
        /utf-8
        /Zc:__cplusplus
        /Zc:preprocessor
)


target_link_options(
    VidCoreNativePlayer
    PRIVATE
        /MANIFEST:EMBED
        "/MANIFESTINPUT:${CMAKE_CURRENT_SOURCE_DIR}/src/app.manifest"
)

target_link_libraries(
    VidCoreNativePlayer
    PRIVATE
        "${WEBVIEW2_STATIC_LOADER}"
        user32
        ole32
        oleaut32
        shell32
        shlwapi
        winhttp
        dwmapi
        version
)

set_target_properties(
    VidCoreNativePlayer
    PROPERTIES
        OUTPUT_NAME "VidCoreNativePlayer"
        VS_DEBUGGER_WORKING_DIRECTORY "$<TARGET_FILE_DIR:VidCoreNativePlayer>"
)

add_custom_command(
    TARGET VidCoreNativePlayer
    POST_BUILD
    COMMAND
        "${CMAKE_COMMAND}" -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/assets"
        "$<TARGET_FILE_DIR:VidCoreNativePlayer>/assets"
    COMMENT "Copying web UI assets"
)
