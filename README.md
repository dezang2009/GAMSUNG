# ABYSS

심층 탐사 전략 시뮬레이션 게임.

- `web/` — 게임 본체 (빌드 과정 없는 HTML/CSS/JS). `web/index.html`을 브라우저로 열면 실행된다.
  - `js/data.js` 데이터(지형·자원·위험·구역), `js/mapgen.js` 지도 생성, `js/game.js` 상태·규칙, `js/ui.js` 화면
- `android/` — `web/`을 그대로 담는 WebView 앱. `cd android && gradle assembleDebug` (Android SDK 35 필요)
