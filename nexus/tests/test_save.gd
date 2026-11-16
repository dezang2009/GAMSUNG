extends RefCounted
## 저장: 저장·불러오기 · 직전 저장본 · 깨진 저장 격리와 복구 · 버전 · 내보내기/가져오기

var t
var Save: Node
var Game: Node
const DIR := "user://test_saves"


func before_each() -> void:
	Save = t.root.get_node("Save")
	Game = t.root.get_node("Game")
	Save.dir = DIR
	_wipe()
	Save.MIGRATIONS = {}


func after_each() -> void:
	_wipe()
	Save.dir = Save.DEFAULT_DIR
	Game.state = {}


func _wipe() -> void:
	DirAccess.make_dir_recursive_absolute(DIR)
	for f in DirAccess.get_files_at(DIR):
		DirAccess.remove_absolute(DIR.path_join(f))


func test_save_and_load_roundtrip() -> void:
	t.eq(Save.load_game(), {"empty": true}, "처음엔 비어 있음")
	Game.new_game()
	Game.state.resources.res_a = 42
	t.ok(Game.save_now(), "저장 성공")
	var saved: Dictionary = Game.state.duplicate(true)
	Game.state = {}
	var r: Dictionary = Game.load_saved()
	t.ok(r.has("data"), "불러오기 성공")
	t.eq(Game.state.resources.res_a, 42, "자원 값 유지")
	t.eq(JSON.stringify(Game.state.planets), JSON.stringify(saved.planets), "행성 진행 유지")


func test_file_has_version_and_prev_is_kept() -> void:
	Game.new_game()
	Game.state.resources.res_a = 1
	Game.save_now()
	Game.state.resources.res_a = 2
	Game.save_now()
	var main = JSON.parse_string(FileAccess.get_file_as_string(Save.main_path()))
	var prev = JSON.parse_string(FileAccess.get_file_as_string(Save.prev_path()))
	t.eq(main.app, "nexus", "앱 이름")
	t.eq(int(main.version), Save.VERSION, "버전 기록")
	t.eq(int(main.data.resources.res_a), 2, "최신 저장")
	t.eq(int(prev.data.resources.res_a), 1, "직전 저장본 보관")
	t.ok(not FileAccess.file_exists(DIR.path_join("main.tmp")), "임시 파일 정리")


func test_broken_save_is_quarantined_and_prev_used() -> void:
	Game.new_game()
	Game.state.resources.res_a = 7
	Game.save_now()
	Game.save_now()
	var f = FileAccess.open(Save.main_path(), FileAccess.WRITE)
	f.store_string("{깨진 저장")
	f.close()
	var r: Dictionary = Save.load_game()
	t.ok(r.get("recovered", false), "직전 저장본으로 복구")
	t.eq(int(r.data.resources.res_a), 7, "복구한 값")
	var broken = Array(DirAccess.get_files_at(DIR)).filter(func(x): return x.begins_with("broken_"))
	t.eq(broken.size(), 1, "깨진 원본은 지우지 않고 broken_ 으로 보관")


func test_broken_without_prev_reports_error() -> void:
	DirAccess.make_dir_recursive_absolute(DIR)
	var f = FileAccess.open(Save.main_path(), FileAccess.WRITE)
	f.store_string("not json")
	f.close()
	var r: Dictionary = Save.load_game()
	t.ok(r.has("error") and r.error.contains("보관"), "오류 안내 + 보관 위치")


func test_versions() -> void:
	var future = JSON.stringify({"app": "nexus", "version": Save.VERSION + 1, "data": {}})
	t.ok(Save.parse_text(future).get("error", "").contains("새 버전"), "미래 버전 거절")
	t.ok(Save.parse_text(JSON.stringify({"app": "other", "version": 1, "data": {}})).get("error", "").contains("NEXUS"), "다른 앱 데이터 거절")
	t.ok(Save.parse_text("hello").has("error"), "형식 오류 거절")
	# 변환(마이그레이션) 체계: 가짜 v0 → v1
	Game.new_game()
	var old: Dictionary = Game.state.duplicate(true)
	old.erase("log")
	Save.MIGRATIONS = {0: func(d): d["log"] = []; return d}
	var r: Dictionary = Save.parse_text(JSON.stringify({"app": "nexus", "version": 0, "data": old}))
	t.ok(r.has("data") and r.data.has("log"), "이전 버전은 변환 함수로 올려요")


func test_export_import() -> void:
	Game.new_game()
	Game.state.resources.res_b = 9
	var text: String = Game.export_text()
	Game.new_game()
	t.eq(Game.state.resources.res_b, 0, "새 게임")
	t.eq(Game.import_text("엉뚱한 글자").has("error"), true, "잘못된 글자 거절")
	t.eq(Game.import_text(text), {"ok": true}, "가져오기 성공")
	t.eq(Game.state.resources.res_b, 9, "가져온 값")


func test_missing_fields_rejected() -> void:
	t.ok(Save.parse_text(JSON.stringify({"app": "nexus", "version": 1, "data": {"meta": {}}})).get("error", "").contains("칸이 없어요"), "필수 칸 검사")
