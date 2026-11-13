# 감성챗 (GAMSUNG)

Gemini 무료 API로 대화하는 안드로이드 AI 채팅 앱입니다.

- 화면: `app/src/main/assets/index.html` (HTML/CSS/JS 한 파일)
- 안드로이드 껍데기: `app/src/main/java/com/gamsung/chat/MainActivity.java` (WebView)
- API 키는 앱 설정 화면에서 입력하며 기기에만 저장됩니다.

## 빌드

Android SDK(플랫폼 35)가 필요합니다.

```
./gradlew assembleRelease
```

결과물: `app/build/outputs/apk/release/app-release.apk`

`signing/gamsung.jks`는 매번 같은 서명으로 빌드해 기존 앱 위에 덮어 설치할 수 있게 하는 키입니다.
