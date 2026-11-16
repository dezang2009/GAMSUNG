extends Node
## Bus — 시스템과 화면을 느슨하게 잇는 신호들. 시스템끼리 서로 직접 부르지 않고 여기로 알려요.

## 게임 상태가 바뀜 (reason: "new_game" · "load" · "import" · "reset" · 명령 이름…)
signal state_changed(reason: String)
## 저장 결과 (ok=false 면 message 에 이유)
signal saved(ok: bool, message: String)
## 설정(화면 모드 등)이 바뀜
signal settings_changed()
