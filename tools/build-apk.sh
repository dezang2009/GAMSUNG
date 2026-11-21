#!/usr/bin/env bash
# 게임을 안드로이드 APK(debug 서명)로 만든다.
# 준비물: JDK 17+, Gradle 8.9+, Android SDK (platforms;android-34, build-tools;34.0.0)
#   export ANDROID_HOME=/path/to/android-sdk
# 사용: 저장소 루트에서 `bash tools/build-apk.sh` -> dist/pixel-adventure-debug.apk
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?ANDROID_HOME 에 Android SDK 경로를 지정해 주세요}"

python3 tools/build.py                                   # dist/play.html 갱신
mkdir -p android/app/src/main/assets/www
cp dist/play.html android/app/src/main/assets/www/index.html
echo "sdk.dir=${ANDROID_HOME}" > android/local.properties

(cd android && gradle --no-daemon assembleDebug)
cp android/app/build/outputs/apk/debug/app-debug.apk dist/pixel-adventure-debug.apk
echo "완료: dist/pixel-adventure-debug.apk"
