#include <windows.h>

import vidcore.application;

int WINAPI wWinMain(
    HINSTANCE instance,
    HINSTANCE,
    PWSTR,
    int show_command
) {
    vidcore::Application application;
    return application.run(instance, show_command);
}
