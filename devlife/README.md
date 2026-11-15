# DEVLIFE — 1인 개발사 키우기

LIFEOS 디자인(오프화이트 바탕·흰 카드·강조색 하나·떠 있는 하단 메뉴·Paperlogy)으로 만든 **텍스트 방치형 성장 게임**이에요.
자취방 책상에서 혼자 앱을 만들기 시작해, 직원을 뽑고 사무실을 넓혀 캠퍼스를 가진 회사로 키워요.

- **코드 쓰기 → 출시**: 버튼을 눌러 코드를 쓰고, 다 차면 앱을 출시해요. 앱은 평점에 따라 사용자를 모으고 초당 수익을 내요.
- **성장**: 장비(키보드·모니터·커피 머신·자동 테스트·광고·서버), 직원 7종(인턴~CTO), 사무실 6단계.
- **소식**: 1~2분마다 사건이 생겨요(버그·리뷰·서버 장애·투자 제안·해커톤 …). 고른 답에 따라 결과가 달라져요.
- **자리 비움**: 앱을 꺼도 최대 8시간까지 75% 효율로 팀이 일해요.
- **회사 매각**: 앱 5개 이상이면 회사를 팔고 ‘통찰’(영구 +5%)을 얻어 다시 시작해요.
- **업적 14개**, 밝게/어둡게 모드. 인터넷 권한·광고·회원가입 없음. 저장은 휴대폰 안(localStorage)에만.

## 개발

```bash
npm install
npm run dev          # 브라우저에서 보기
npm test             # 엔진 단위 테스트 (Vitest)
npm run test:e2e     # 빌드 후 화면 통합 테스트 (Playwright)
npm run apk          # Android APK (android/keystore 에 서명 키 필요)
node scripts/gen-android-assets.cjs   # 아이콘·시작 화면 다시 만들기
```

## 구조

- `src/game/` — 화면과 분리된 순수 게임 로직: `engine.js`(경제·시간·매각), `events.js`(사건·선택지), `data.js`(수치), `save.js`(저장·복구)
- `src/ui/` — `app.js`(뼈대·시계·저장·뒤로 가기), `views.js`(홈·성장·소식·기록)
- `src/styles/` — LIFEOS 토큰·기본 스타일 + `game.css`

글꼴: Paperlogy (SIL OFL 1.1, `src/assets/fonts/paperlogy/OFL.txt`).
