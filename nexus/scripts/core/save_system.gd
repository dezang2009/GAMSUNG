extends Node
## Save — 진행 저장·불러오기 (user:// 폴더의 JSON 파일).
##  - 저장 형식: { app, version, saved_at, data }
##  - 쓰기: 임시 파일에 다 쓴 뒤 바꿔 끼워요(쓰다가 꺼져도 원본이 남게). 그 전 저장본은 main.prev.json 으로.
##  - 읽기: version 을 보고 MIGRATIONS 로 최신 구조까지 올려요. 깨졌으면 broken_시각.json 으로 옮기고 직전 저장본으로.
##  - 설정(화면 모드 등)은 따로 settings.cfg.

const APP := "nexus"
const VERSION := 2
const DEFAULT_DIR := "user://saves"

## 버전 n → n+1 변환 함수 (Callable). 저장 구조를 바꾸면 VERSION 을 올리고 여기에 더해요.
##  1 → 2 (Phase 2): 종별 연구 데이터 · 조사 기록 · 씨앗 추가
var MIGRATIONS := {1: _v1_to_v2}


static func _v1_to_v2(d: Dictionary) -> Dictionary:
	var out := d.duplicate(true)
	if typeof(out.get("collection")) == TYPE_DICTIONARY:
		out.collection["research"] = out.collection.get("research", {})
	out["exploration"] = out.get("exploration", {"surveys": {}})
	out["seed"] = out.get("seed", hash(out.get("meta", {}).get("created_at", 0)))
	return out

var dir := DEFAULT_DIR
var last_saved_at := 0
var last_error := ""


func main_path() -> String:
	return dir.path_join("main.json")


func prev_path() -> String:
	return dir.path_join("main.prev.json")


func _ensure_dir() -> bool:
	return DirAccess.make_dir_recursive_absolute(dir) == OK or DirAccess.dir_exists_absolute(dir)


## 저장. 성공 여부를 돌려주고 Bus.saved 로 알려요.
func save(data: Dictionary) -> bool:
	var ok := _write(data)
	Bus.saved.emit(ok, last_error)
	return ok


func _write(data: Dictionary) -> bool:
	last_error = ""
	if not _ensure_dir():
		last_error = "저장 폴더를 만들 수 없어요"
		return false
	var now := int(Time.get_unix_time_from_system())
	var text := JSON.stringify({"app": APP, "version": VERSION, "saved_at": now, "data": data})
	var tmp := dir.path_join("main.tmp")
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		last_error = "저장 파일을 열 수 없어요 (%s)" % error_string(FileAccess.get_open_error())
		return false
	f.store_string(text)
	f.close()
	# 다 썼는지 확인
	if FileAccess.get_file_as_string(tmp).length() != text.length():
		last_error = "저장 공간이 부족해 끝까지 쓰지 못했어요"
		DirAccess.remove_absolute(tmp)
		return false
	if FileAccess.file_exists(main_path()):
		DirAccess.remove_absolute(prev_path())
		DirAccess.rename_absolute(main_path(), prev_path())
	var err := DirAccess.rename_absolute(tmp, main_path())
	if err != OK:
		last_error = "저장 파일을 바꿔 끼우지 못했어요 (%s)" % error_string(err)
		return false
	last_saved_at = now
	return true


## 불러오기 → { data } · { empty: true } · { data, recovered: true } · { error }
func load_game() -> Dictionary:
	if not FileAccess.file_exists(main_path()):
		return _try_prev({"empty": true})
	var r := parse_text(FileAccess.get_file_as_string(main_path()))
	if r.has("data"):
		return r
	# 깨진 저장: 지우지 않고 옮겨 둬요
	var broken := dir.path_join("broken_%d.json" % Time.get_unix_time_from_system())
	DirAccess.rename_absolute(main_path(), broken)
	return _try_prev({"error": "저장 파일을 읽을 수 없어요 (%s). 원본은 %s 에 보관했어요." % [r.error, broken.get_file()]})


func _try_prev(fallback: Dictionary) -> Dictionary:
	if FileAccess.file_exists(prev_path()):
		var r := parse_text(FileAccess.get_file_as_string(prev_path()))
		if r.has("data"):
			r["recovered"] = true
			return r
	return fallback


## 저장 글자 → { data } 또는 { error } (내보내기 글자도 같은 형식)
func parse_text(text: String) -> Dictionary:
	var json := JSON.new()
	if json.parse(text.strip_edges()) != OK or typeof(json.data) != TYPE_DICTIONARY:
		return {"error": "저장 데이터 형식이 아니에요"}
	var obj: Dictionary = json.data
	if obj.get("app") != APP or typeof(obj.get("data")) != TYPE_DICTIONARY:
		return {"error": "NEXUS 저장 데이터가 아니에요"}
	var v := int(obj.get("version", 1))
	if v > VERSION:
		return {"error": "이 앱보다 새 버전(%d)의 저장 데이터예요" % v}
	var d: Dictionary = obj.data
	while v < VERSION:
		if not MIGRATIONS.has(v):
			return {"error": "저장 버전 %d 을(를) 올릴 방법이 없어요" % v}
		d = MIGRATIONS[v].call(d)
		v += 1
	var why := validate(d)
	if why != "":
		return {"error": why}
	return {"data": d, "saved_at": int(obj.get("saved_at", 0))}


## 꼭 있어야 하는 칸 확인 (빈 문자열이면 정상)
func validate(d: Dictionary) -> String:
	for k in ["meta", "resources", "collection", "planets", "research", "log", "exploration", "seed"]:
		if not d.has(k):
			return "'%s' 칸이 없어요" % k
	if typeof(d.resources) != TYPE_DICTIONARY or typeof(d.planets) != TYPE_DICTIONARY:
		return "자원·행성 데이터가 올바르지 않아요"
	return ""


func export_text(data: Dictionary) -> String:
	return JSON.stringify({"app": APP, "version": VERSION, "saved_at": int(Time.get_unix_time_from_system()), "data": data})


func has_save() -> bool:
	return FileAccess.file_exists(main_path()) or FileAccess.file_exists(prev_path())


## 저장 파일 지우기 (깨진 저장 보관본은 남겨요)
func clear() -> void:
	DirAccess.remove_absolute(main_path())
	DirAccess.remove_absolute(prev_path())


# ── 설정 ──
const SETTINGS_PATH := "user://settings.cfg"


func load_settings() -> Dictionary:
	var cfg := ConfigFile.new()
	var out := {"theme": "dark"}
	if cfg.load(SETTINGS_PATH) == OK:
		out.theme = cfg.get_value("display", "theme", "dark")
	return out


func save_settings(s: Dictionary) -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("display", "theme", s.get("theme", "dark"))
	cfg.save(SETTINGS_PATH)
