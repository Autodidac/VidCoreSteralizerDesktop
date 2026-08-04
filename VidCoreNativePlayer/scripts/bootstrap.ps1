param(
    [string]$WebView2Version = "1.0.4078.44"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$External = Join-Path $Root "external"
$PackageDirectory = Join-Path $External "Microsoft.Web.WebView2.$WebView2Version"
$Header = Join-Path $PackageDirectory "build\native\include\WebView2.h"

New-Item -ItemType Directory -Force -Path $External | Out-Null

if (-not (Test-Path $Header)) {
    $NugetPackage = Join-Path $External "Microsoft.Web.WebView2.$WebView2Version.nupkg"
    $ZipPackage = Join-Path $External "Microsoft.Web.WebView2.$WebView2Version.zip"
    $Uri = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$WebView2Version"

    Write-Host "Downloading Microsoft.Web.WebView2 $WebView2Version..."
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $NugetPackage

    Copy-Item -Force $NugetPackage $ZipPackage
    if (Test-Path $PackageDirectory) {
        Remove-Item -Recurse -Force $PackageDirectory
    }

    Expand-Archive -Path $ZipPackage -DestinationPath $PackageDirectory -Force
    Remove-Item -Force $ZipPackage
}

if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    throw "CMake 3.28 or newer is required and was not found on PATH."
}

Write-Host "Configuring Visual Studio 2022 x64..."
Push-Location $Root
try {
    cmake --fresh --preset vs2022-x64
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configuration failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
