# NEXUS

2D 턴제 수집형 RPG + 행성 개척 (Godot 4.7, GDScript, 세로 화면).

## 실행·테스트

```bash
godot --path .                                   # 실행 (편집기 없이)
godot --headless --path . --script res://tests/run_tests.gd   # 테스트 (실패 시 종료 코드 1)
xvfb-run -a godot --path . --resolution 720x1280 --script res://tools/capture.gd -- <폴더>  # 화면 캡처
```

## 구조

```
data/            설정(콘텐츠) — 이름·속성·수치는 여기서만 바꿔요. placeholder:true = 미확정 임시 데이터
  elements.json  기본 속성 4종 (열·생물·유체·광물, 확정) + 상성표(미정, 기본 1배)
  rarities / roles / resources / planets / regions / species.json
scripts/core/    Bus(신호) · Data(읽기·검사·찾기) · DataSchema(형식) · Save(저장) · Game(진행 상태·명령)
scripts/ui/      main(화면 틀·탭·뒤로 가기·시트) · kit(UI 조각·테마) · palette(색) · screens/ · widgets/
assets/          fonts(Paperlogy, OFL) · placeholder(임시 그림) · final(최종 에셋)
tests/           test_*.gd + fixtures/bad_data(일부러 틀린 데이터)
tools/capture.gd 화면 캡처
```

- 시스템끼리 직접 부르지 않고 `Game`(명령) → `Bus.state_changed`(알림) → 화면 순서로 흘러요.
- 저장: `user://saves/main.json` (`{app, version, saved_at, data}`), 직전 저장본 `main.prev.json`, 깨진 저장은 `broken_시각.json` 으로 보관. 구조가 바뀌면 `Save.VERSION` 을 올리고 `MIGRATIONS` 에 변환 함수를 더해요.
- 지역 해금 조건은 `{any:[…]}` / `{all:[…]}` — 시작할 때 막다른 길(열 수 없는 지역)을 검사해요.
