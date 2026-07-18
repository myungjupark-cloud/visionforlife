# 진리서재 APK 빌드 (Android 6+, minSdk 23)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$Jbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $Jbr) {
    $env:JAVA_HOME = $Jbr
    $env:PATH = "$Jbr\bin;$env:PATH"
}

$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $Sdk) {
    $env:ANDROID_HOME = $Sdk
    $env:ANDROID_SDK_ROOT = $Sdk
}

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "Building release APK..."

if (-not (Test-Path ".\gradlew.bat")) {
    Write-Host "Gradle wrapper 없음 — 생성 중..."
    $gradleCmd = Get-Command gradle -ErrorAction SilentlyContinue
    if ($gradleCmd) {
        gradle wrapper --gradle-version 8.2
    } else {
        throw "gradlew.bat 없음. Gradle 설치 후 wrapper 생성 필요."
    }
}

.\gradlew.bat assembleRelease --no-daemon

$apk = Get-ChildItem "app\build\outputs\apk\release\*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apk) {
    $dest = Join-Path $Root "TruthLib-release.apk"
    Copy-Item $apk.FullName $dest -Force
    Write-Host ""
    Write-Host "OK: $dest"
    Write-Host "Size: $([math]::Round($apk.Length/1MB, 2)) MB"
} else {
    throw "APK not found under app\build\outputs\apk\release\"
}
