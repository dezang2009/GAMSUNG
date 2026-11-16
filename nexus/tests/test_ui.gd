extends RefCounted
## 화면: 첫 화면 → 새 탐사 → 5개 탭 이동 → 지역 상세 → 뒤로 가기 → 설정·시트 → 화면 모드 → 터치 크기

var t
var Game: Node
var Save: Node
var main: Control


func before_each() -> void:
	Game = t.root.get_node("Game")
	Save = t.root.get_node("Save")
	Save.dir = "user://test_ui_saves"
	DirAccess.make_dir_recursive_absolute(Save.dir)
	for f in DirAccess.get_files_at(Save.dir):
		DirAccess.remove_absolute(Save.dir.path_join(f))
	Game.state = {}
	Game.settings.theme = "dark"
	main = load("res://scenes/main.tscn").instantiate()
	t.root.add_child(main)
	await t.process_frame


func after_each() -> void:
	main.queue_free()
	await t.process_frame
	Game.state = {}
	Save.dir = Save.DEFAULT_DIR


func _find(name: String) -> Node:
	return main.find_child(name, true, false)


func _press(name: String) -> void:
	var b = _find(name)
	t.ok(b != null and b.has_signal("pressed"), "버튼 '%s' 있음" % name)
	if b:
		b.pressed.emit()
	await t.process_frame
	await t.process_frame


func test_title_then_new_game() -> void:
	t.ok(_find("NewGameButton") != null, "첫 화면에 탐사 시작")
	t.ok(_find("Nav") == null, "첫 화면에는 하단 메뉴 없음")
	await _press("NewGameButton")
	t.ok(Game.has_game(), "새 게임 생성")
	t.ok(_find("Nav") != null and _find("TopBar") != null, "게임 화면: 상단 막대·하단 메뉴")
	t.ok(_find("Page_base") != null, "기지 화면부터")
	t.ok(_find("ProgressCard") != null, "개척 진행도 카드")


func test_five_tabs() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	for id in ["planet", "explore", "creatures", "research", "base"]:
		await _press("Nav_" + id)
		t.ok(_find("Page_" + id) != null, "탭 '%s' 화면" % id)
	await _press("Nav_planet")
	t.eq(_find("RegionList").get_child_count(), 5, "행성 탭: 지역 5곳")
	t.ok(_find("PlanetView") != null, "행성 그림")
	await _press("Nav_creatures")
	t.eq(_find("PartySlots").get_child_count(), 5, "편성 5칸")


func test_push_and_back() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	await _press("Nav_planet")
	await _press("Region_region_02")
	t.ok(_find("Page_region") != null, "지역 상세로 이동")
	t.eq(main.depth(), 2, "화면 쌓임")
	t.ok(_find("BackButton") != null, "뒤로 버튼")
	await _press("BackButton")
	t.ok(_find("Page_planet") != null, "뒤로 → 행성")
	# 안드로이드 뒤로 가기 규칙: 하위 화면 → 탭 처음 → 기지 → (종료)
	await _press("Region_region_01")
	t.ok(main.back(), "뒤로 1")
	await t.process_frame
	t.ok(main.back(), "뒤로 2: 기지로")
	await t.process_frame
	t.eq(main.tab, "base", "기지 탭")
	t.ok(not main.back(), "기지 첫 화면에서는 앱 종료 차례")


func test_settings_sheet_and_theme() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	await _press("SettingsButton")
	t.ok(_find("Page_settings") != null, "설정 화면")
	t.ok(_find("ContentInfo").get_child(1).text.contains("열, 생물, 유체, 광물"), "확정 속성 표시")
	await _press("ExportButton")
	t.ok(_find("ExportText") != null and _find("ExportText").text.begins_with("{\"app\":\"nexus\""), "내보내기 시트")
	t.ok(main.back(), "뒤로 가기로 시트 닫힘")
	await t.process_frame
	t.ok(_find("ExportText") == null, "시트 사라짐")
	await _press("Theme_light")
	t.eq(Game.settings.theme, "light", "밝게 저장")
	t.ok(_find("Page_settings") != null, "모드를 바꿔도 같은 화면 유지")
	await _press("Theme_dark")


func test_reset_needs_confirm() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	await _press("SettingsButton")
	await _press("ResetButton")
	await _press("SheetCancel")
	t.ok(Game.has_game(), "취소하면 그대로")
	await _press("ResetButton")
	await _press("SheetOk")
	t.ok(not Game.has_game(), "확인하면 초기화")
	t.ok(_find("NewGameButton") != null, "첫 화면으로")


func test_touch_targets() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	for id in ["base", "planet", "explore", "creatures", "research"]:
		await _press("Nav_" + id)
		var small = []
		for b in main.find_children("*", "BaseButton", true, false) + main.find_children("*", "TapCard", true, false):
			if b.is_visible_in_tree() and (b.size.y < 87.5 or b.size.x < 87.5):
				small.append("%s %dx%d" % [b.name, b.size.x, b.size.y])
		t.ok(small.is_empty(), "탭 '%s' 버튼 모두 88px(44dp) 이상: %s" % [id, small])


func test_phase2_collection_flow() -> void:
	Game.new_game()
	Game.state.seed = 4242
	await t.process_frame
	await t.process_frame
	await _press("Nav_creatures")
	t.eq(_find("OwnedGrid").get_child_count(), 3, "보유 개체 3 (시작 개체)")
	await _press("Filter_heat")
	t.eq(_find("OwnedGrid").get_child_count(), 1, "열 속성 거르기")
	await _press("Filter_all")
	await _press("Owned_c1")
	t.ok(_find("Page_creature") != null and _find("StatsCard") != null, "개체 상세")
	await _press("OpenSpecies")
	t.ok(_find("Page_species") != null and _find("ResearchCard") != null, "도감 상세 (연구)")
	t.ok(main.back(), "뒤로")
	t.ok(main.back(), "뒤로")
	await t.process_frame
	await _press("DexCard")
	t.eq(_find("DexGrid").get_child_count(), 20, "도감 20칸")
	t.ok(_find("Dex_sp_04") is PanelContainer, "모르는 개체는 누를 수 없는 칸")


func test_phase2_survey_flow() -> void:
	Game.new_game()
	await t.process_frame
	await t.process_frame
	await _press("Nav_explore")
	await _press("Region_region_01")
	t.ok(_find("SurveyCard") != null, "조사 카드")
	await _press("SurveyButton")
	t.ok(_find("SurveyResult") != null, "조사 결과 창")
	t.eq(ExplorationSystem.done(Game.state, "region_01"), 1, "1차 조사 기록")
	await _press("SurveyOk")
	t.ok(_find("SurveyResult") == null, "결과 창 닫힘")
	for i in 2:
		await _press("SurveyButton")
		await _press("SurveyOk")
	var b := _find("SurveyButton") as Button
	t.ok(b.disabled and b.text.contains("모두 마쳤어요"), "조사 끝나면 버튼 잠김 + 이유")
	t.ok(Game.state.collection.seen.size() > 3, "조사로 도감이 늘어남")


func _wait(n := 4) -> void:
	for i in n:
		await t.process_frame


func test_region_cards_do_not_overlap() -> void:
	Game.new_game()
	await _wait()
	await _press("Nav_planet")
	await _wait()
	var list = _find("RegionList")
	var prev_bottom := -1.0
	var ok := true
	var info := []
	for card in list.get_children():
		var r: Rect2 = card.get_global_rect()
		var inner: Control = card.get_child(0)
		info.append("%s y=%d h=%d 내용h=%d" % [card.name, r.position.y, r.size.y, inner.get_combined_minimum_size().y])
		if r.position.y < prev_bottom - 0.5 or r.size.y + 0.5 < inner.get_combined_minimum_size().y:
			ok = false
		prev_bottom = r.end.y
	t.ok(ok, "지역 카드가 겹치지 않고 내용만큼 커져요: %s" % [info])


func test_map_tap_opens_popup() -> void:
	Game.new_game()
	await _wait()
	await _press("Nav_planet")
	var view = _find("PlanetView")
	view.region_pressed.emit("region_04")
	await _wait()
	var pop = _find("RegionPopup")
	t.ok(pop != null, "지도에서 지역을 누르면 정보 창")
	t.ok(main.depth() == 1, "화면 이동 없이 창만")
	t.ok(_find("PopupSurvey") == null, "잠긴 지역은 조사 버튼 없음")
	main.close_sheet(null)
	await _wait()
	view.region_pressed.emit("region_01")
	await _wait()
	await _press("PopupDetail")
	t.ok(_find("Page_region") != null, "자세히 보기 → 지역 상세")
	t.ok(_find("RegionPopup") == null, "창은 닫혀요")


func _touch(pos: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.position = pos
	e.pressed = pressed
	Input.parse_input_event(e)


func _drag(pos: Vector2, rel: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.position = pos
	e.relative = rel
	Input.parse_input_event(e)


func test_real_touch_scroll_and_tap() -> void:
	# 휴대폰처럼 창 크기 = 화면 크기 (헤드리스 기본 창은 64px 이라 좌표가 늘어나요)
	var old_size: Vector2i = t.root.size
	t.root.size = Vector2i(720, 1280)
	Game.new_game()
	await _wait()
	await _press("Nav_explore")
	await _wait()
	var scroll = _find("Scroll")
	var card = _find("Region_region_01")
	var p: Vector2 = card.get_global_rect().get_center()
	# 카드 위에서 시작해 위로 끌기 → 스크롤만, 화면 이동 없음
	_touch(p, true)
	await _wait(2)
	var q := p
	for i in 8:
		q += Vector2(0, -40)
		_drag(q, Vector2(0, -40))
		await _wait(1)
	_touch(q, false)
	await _wait(2)
	t.ok(scroll.scroll_vertical > 0 or scroll.get_v_scroll_bar().max_value <= scroll.size.y + 1, "카드 위에서 끌어도 스크롤 (내용이 짧으면 끝까지만)")
	t.eq(main.depth(), 1, "끌기는 카드를 누르지 않아요")
	await _wait(40)
	scroll.scroll_vertical = 0
	await _wait(2)
	# 살짝 흔들린 탭 → 카드가 눌려 이동
	p = _find("Region_region_01").get_global_rect().get_center()
	_touch(p, true)
	await _wait(1)
	_drag(p + Vector2(0, 5), Vector2(0, 5))
	await _wait(1)
	_touch(p + Vector2(0, 5), false)
	await _wait(3)
	t.ok(_find("Page_region") != null, "5px 흔들린 탭도 카드를 눌러요")
	t.root.size = old_size
