extends RefCounted
## 진행 상태: 새 게임 초기값 · 지역 해금(대체 경로) · 진행도 · 데이터 추가 대비

var t
var Game: Node
var Data: Node


func before_each() -> void:
	Game = t.root.get_node("Game")
	Data = t.root.get_node("Data")
	Game.new_game()


func after_each() -> void:
	Game.state = {}


func test_new_game_from_data() -> void:
	t.eq(Game.state.current_planet, "planet_01", "첫 행성")
	t.eq(Game.state.resources.keys(), ["res_a", "res_b", "res_c"], "자원은 설정 파일 그대로")
	t.eq(Game.state.collection.party, ["", "", "", "", ""], "편성 5칸")
	t.eq(Game.state.log.size(), 1, "시작 기록")
	t.eq(int(Game.state.meta.content_version), int(Data.meta.content_version), "콘텐츠 버전 기록")


func test_region_unlock_paths() -> void:
	var r = func(id): return Data.get_item("regions", id)
	t.ok(Game.is_region_unlocked(r.call("region_01")), "지역 1: 처음부터")
	t.ok(not Game.is_region_unlocked(r.call("region_02")), "지역 2: 잠김")
	Game.state.planets.planet_01.cleared.region_01 = true
	t.ok(Game.is_region_unlocked(r.call("region_02")) and Game.is_region_unlocked(r.call("region_03")), "지역 1 개척 → 2·3 열림")
	t.ok(not Game.is_region_unlocked(r.call("region_04")), "지역 4: 아직")
	Game.state.planets.planet_01.cleared.region_03 = true
	t.ok(Game.is_region_unlocked(r.call("region_04")), "지역 4: 2 또는 3 중 하나만 개척해도 열림 (대체 경로)")
	t.ok(not Game.is_region_unlocked(r.call("region_05")), "지역 5: 4 개척 필요")


func test_progress() -> void:
	t.eq(Game.planet_progress(), 0.0, "처음 0%")
	Game.state.planets.planet_01.cleared.region_01 = true
	t.eq(Game.planet_progress(), 0.2, "5곳 중 1곳 = 20%")


func test_sync_fills_new_content() -> void:
	Game.state.resources.erase("res_c")
	Game.state.planets.erase("planet_01")
	Game._sync_with_data()
	t.ok(Game.state.resources.has("res_c"), "설정에 새로 생긴 자원은 채워요")
	t.ok(Game.state.planets.has("planet_01"), "설정에 새로 생긴 행성도 채워요")


func test_log_is_capped() -> void:
	for i in 250:
		Game.add_log("test", "기록 %d" % i)
	t.eq(Game.state.log.size(), Game.LOG_MAX, "기록 최대 개수")
	t.eq(Game.state.log[0].text, "기록 249", "최근 기록이 맨 앞")
