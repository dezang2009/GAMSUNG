extends Node
## Game — 진행 상태(저장 대상) 하나와 그 상태를 바꾸는 명령들.
## 화면은 state 를 읽기만 하고, 바꿀 땐 여기 명령을 불러요. 바뀌면 Bus.state_changed 로 알리고 곧 자동 저장해요.
##
## state 구조 (저장 파일의 data):
##   meta:       { created_at, updated_at, play_seconds, content_version }
##   resources:  { 자원 id: 양 }
##   collection: { owned: [개체 인스턴스], seen: { 종 id: 처음 본 시각 }, research: { 종 id: 연구 데이터 }, party: [uid ×5, 빈칸 ""], next_uid }
##   exploration: { surveys: { 지역 id: 조사 횟수 } }
##   seed:       조사 결과를 정하는 씨앗 (새 게임마다 하나)
##   planets:    { 행성 id: { cleared: { 지역 id: true }, env: {}, facilities: [], placed: {} } }
##   current_planet
##   research:   { done: {}, active: null }
##   log:        [ { t, kind, text } ]  (최근 200개)

const LOG_MAX := 200
const AUTOSAVE_DELAY := 0.6

var state: Dictionary = {}
var settings: Dictionary = {"theme": "dark"}
var _save_timer: Timer
var _session_start := 0


func _ready() -> void:
	settings = Save.load_settings()
	_save_timer = Timer.new()
	_save_timer.one_shot = true
	_save_timer.wait_time = AUTOSAVE_DELAY
	_save_timer.timeout.connect(save_now)
	add_child(_save_timer)


func has_game() -> bool:
	return not state.is_empty()


## 새 탐사 시작: 데이터에서 시작 자원·첫 행성·처음부터 열린 지역을 읽어 만들어요.
func new_game() -> void:
	var now := int(Time.get_unix_time_from_system())
	var res := {}
	for r in Data.all("resources"):
		res[r.id] = int(r.start)
	var planets := {}
	var first := ""
	var sorted := Data.all("planets").duplicate()
	sorted.sort_custom(func(a, b): return a.order < b.order)
	for p in sorted:
		planets[p.id] = {"cleared": {}, "env": {}, "facilities": [], "placed": {}}
		if first == "":
			first = p.id
	state = {
		"meta": {"created_at": now, "updated_at": now, "play_seconds": 0, "content_version": int(Data.meta.get("content_version", 1))},
		"resources": res,
		"collection": {"owned": [], "seen": {}, "research": {}, "party": ["", "", "", "", ""], "next_uid": 1},
		"exploration": {"surveys": {}},
		"seed": randi(),
		"planets": planets,
		"current_planet": first,
		"research": {"done": {}, "active": null},
		"log": [],
	}
	add_log("base", "탐사 기지를 열었어요. 첫 행성 탐사를 시작해요.")
	# 시작 개체 (설정 파일 meta.starting_creatures)
	var names: Array[String] = []
	for sid in Data.meta.get("starting_creatures", []):
		if CollectionSystem.acquire(state, sid, "start", "", now).kind == "new":
			names.append(Data.get_item("species", sid).name)
	if not names.is_empty():
		add_log("creature", "함께 출발한 개체: %s" % ", ".join(names))
	_changed("new_game", true)


## 저장된 진행 불러오기 → Save.load_game() 결과 그대로
func load_saved() -> Dictionary:
	var r := Save.load_game()
	if r.has("data"):
		state = r.data
		_sync_with_data()
		_changed("load", false)
	return r


## 내보낸 글자 가져오기 → { ok } 또는 { error }
func import_text(text: String) -> Dictionary:
	var r := Save.parse_text(text)
	if r.has("error"):
		return r
	state = r.data
	_sync_with_data()
	_changed("import", true)
	return {"ok": true}


func export_text() -> String:
	return Save.export_text(state)


## 기록을 지우고 처음 화면으로
func reset() -> void:
	_save_timer.stop()
	Save.clear()
	state = {}
	Bus.state_changed.emit("reset")


## 설정 파일에 새 자원·행성이 생겼으면 진행 데이터에 빈 칸을 채워요 (콘텐츠 업데이트 대비)
func _sync_with_data() -> void:
	for r in Data.all("resources"):
		if not state.resources.has(r.id):
			state.resources[r.id] = int(r.start)
	for p in Data.all("planets"):
		if not state.planets.has(p.id):
			state.planets[p.id] = {"cleared": {}, "env": {}, "facilities": [], "placed": {}}
	if not state.planets.has(state.get("current_planet", "")) and not state.planets.is_empty():
		state.current_planet = state.planets.keys()[0]


# ── 읽기 도우미 ──
func planet_state(planet_id: String = "") -> Dictionary:
	return state.planets.get(planet_id if planet_id != "" else state.current_planet, {})


func is_region_unlocked(region: Dictionary) -> bool:
	return DataSchema.is_unlocked(region.unlock, planet_state(region.planet).get("cleared", {}))


func is_region_cleared(region: Dictionary) -> bool:
	return planet_state(region.planet).get("cleared", {}).has(region.id)


## 개척 진행도 (0~1). 지금은 개척한 지역 비율. Phase 5 에서 환경 지표·시설이 더해져요.
func planet_progress(planet_id: String = "") -> float:
	var pid := planet_id if planet_id != "" else str(state.current_planet)
	var regions := Data.regions_of(pid)
	if regions.is_empty():
		return 0.0
	return float(planet_state(pid).get("cleared", {}).size()) / regions.size()


# ── 탐사 ──
## 지역 조사. { results } 또는 { error }
func survey_region(region_id: String) -> Dictionary:
	var r := Data.get_item("regions", region_id)
	if r.is_empty():
		return {"error": "알 수 없는 지역이에요"}
	var why := ExplorationSystem.blocked_reason(state, r, is_region_unlocked(r))
	if why != "":
		return {"error": why}
	var now := int(Time.get_unix_time_from_system())
	var results := ExplorationSystem.survey(state, r, now)
	var n := ExplorationSystem.done(state, region_id)
	var parts: Array[String] = []
	for x in results:
		var nm: String = Data.get_item("species", x.species).name
		if x.type == "egg":
			parts.append("%s 알 확보" % nm if x.acquire.kind == "new" else "%s 알 (중복 → 연구 데이터)" % nm)
		elif x.new:
			parts.append("%s 첫 목격" % nm)
	add_log("explore", "%s %d차 조사%s" % [r.name, n, (" — " + ", ".join(parts)) if not parts.is_empty() else ""])
	_changed("survey", true)
	return {"results": results, "survey": n}


# ── 기록·저장 ──
func add_log(kind: String, text: String) -> void:
	state.log.push_front({"t": int(Time.get_unix_time_from_system()), "kind": kind, "text": text})
	if state.log.size() > LOG_MAX:
		state.log.resize(LOG_MAX)


func _changed(reason: String, save_soon: bool) -> void:
	state.meta.updated_at = int(Time.get_unix_time_from_system())
	Bus.state_changed.emit(reason)
	if save_soon:
		request_save()


func request_save() -> void:
	if has_game():
		_save_timer.start()


func save_now() -> bool:
	if not has_game():
		return false
	_save_timer.stop()
	return Save.save(state)


func set_theme(mode: String) -> void:
	settings.theme = mode
	Save.save_settings(settings)
	Bus.settings_changed.emit()


## 앱이 백그라운드로 가거나 닫힐 때 바로 저장
func _notification(what: int) -> void:
	if what in [NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_WM_CLOSE_REQUEST, NOTIFICATION_APPLICATION_FOCUS_OUT]:
		if has_game() and not _save_timer.is_stopped():
			save_now()
