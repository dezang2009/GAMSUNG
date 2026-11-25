# GAMSUNG · 뉴스 요약 (Android)

매일 정해진 시각에 구글뉴스 헤드라인(주요·경제·IT·국제)을 모아 Claude로 7줄 요약하고, 앱과 홈 화면 위젯에 보여주는 앱.

## 설치
1. `app-release.apk`를 폰에 받아 설치 (출처를 알 수 없는 앱 허용 필요)
2. 앱을 열고 Claude API 키 입력 → 요약 시각(기본 7시) 설정 → **저장하고 지금 요약**
3. 홈 화면 길게 누르기 → 위젯 → **뉴스 요약** 추가. ↻ 누르면 새로 요약

## 빌드
```
ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
```
결과: `app/build/outputs/apk/release/app-release.apk`

## 구조
- `NewsRepository.kt` — RSS 수집, Claude 요약(anthropic-java SDK), 저장
- `NewsWorker.kt` — WorkManager로 매일 자동 실행
- `NewsWidget.kt` — 홈 화면 위젯
- `MainActivity.kt` — 설정과 요약 화면
