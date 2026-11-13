# GAMSUNG

Gemini 무료 API를 쓰는 안드로이드 앱 두 개가 들어 있습니다.

| 앱 | 폴더 | 설명 |
|---|---|---|
| 감성챗 | `app/` | AI 채팅 |
| 감성모험 | `adventure/` | AI가 이야기꾼인 텍스트 어드벤처 게임 |

- 각 앱의 화면은 `src/main/assets/index.html` 한 파일(HTML/CSS/JS)이고, `MainActivity.java`가 이를 WebView로 띄웁니다.
- API 키는 각 앱의 설정 화면에서 입력하며 기기에만 저장됩니다.

## 빌드

Android SDK(플랫폼 35)가 필요합니다.

```
./gradlew assembleRelease
```

결과물: `app/build/outputs/apk/release/app-release.apk`, `adventure/build/outputs/apk/release/adventure-release.apk`

`signing/gamsung.jks`는 매번 같은 서명으로 빌드해 기존 앱 위에 덮어 설치할 수 있게 하는 키입니다.
