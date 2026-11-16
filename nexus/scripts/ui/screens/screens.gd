class_name Screens
extends RefCounted
## 화면 내용 만들기. 모두 지금 데이터·진행 상태만 보여 줘요 (작동하지 않는 버튼은 만들지 않아요).
## 아직 다음 Phase 에서 생길 기능은 ‘언제 열리는지’를 글로만 알려 줘요.


static func build(main, id: String, args: Dictionary) -> Control:
	match id:
		"base":
			return base(main)
		"planet":
			return planet(main)
		"region":
			return region(main, args)
		"explore":
			return explore(main)
		"creatures":
			return creatures(main)
		"research":
			return research(main)
		"settings":
			return settings(main)
	return UI.empty_note("알 수 없는 화면: %s" % id)


static func _expand(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return c


static func _c() -> Dictionary:
	return Palette.c


static func _region_state(r: Dictionary) -> String:
	if Game.is_region_cleared(r):
		return "cleared"
	return "open" if Game.is_region_unlocked(r) else "locked"


## 해금 조건을 말로 (any = 또는, all = 그리고)
static func unlock_text(r: Dictionary) -> String:
	var mode: String = r.unlock.keys()[0]
	var parts: Array[String] = []
	for c in r.unlock[mode]:
		match c.type:
			"start":
				return "처음부터 열려 있어요"
			"region_cleared":
				parts.append("%s 개척" % Data.get_item("regions", c.region).get("name", c.region))
	return (" 또는 " if mode == "any" else " 그리고 ").join(parts) + " 후 열려요"


# ── 데이터 오류 ──
static func data_errors(main) -> Control:
	var m := _page_margin()
	var v := UI.vbox(20)
	m.add_child(v)
	v.add_child(UI.title("설정 데이터 오류", UI.XL))
	v.add_child(UI.label("res://data 의 설정 파일에 문제가 있어 게임을 시작하지 않았어요. 아래를 고친 뒤 다시 실행해 주세요.", UI.M, _c().muted))
	var list := UI.vbox(10)
	list.name = "ErrorList"
	for e in Data.errors:
		list.add_child(UI.label("· " + e, UI.S, _c().danger))
	v.add_child(UI.card([list]))
	return _scroll(m)


# ── 첫 화면 ──
static func title(main) -> Control:
	var m := _page_margin()
	var v := UI.vbox(28)
	v.alignment = BoxContainer.ALIGNMENT_END
	m.add_child(v)
	m.add_theme_constant_override("margin_bottom", 120)
	var logo := UI.label("NEXUS", 132, _c().text, "Display")
	v.add_child(logo)
	v.add_child(UI.label("미지의 행성을 탐사하고, 생명체를 발견하고, 행성을 되살리는 이야기", UI.M, _c().muted))
	var tags := UI.hbox(10)
	for e in Data.all("elements"):
		tags.add_child(UI.chip(e.name, Color(e.color)))
	v.add_child(tags)
	v.add_child(UI.spacer(40))
	if Save.has_save():
		var cont := UI.button("이어서 탐사하기", func():
			var r := Game.load_saved()
			if r.has("error"):
				main.toast(r.error, true)
			elif r.get("recovered", false):
				main.toast("최근 저장이 손상돼 직전 저장으로 이어서 해요")
		, "", "ContinueButton")
		v.add_child(cont)
		v.add_child(UI.button("새로 시작", func():
			main.confirm("새로 시작할까요?", "저장된 탐사 기록이 지워지고 처음부터 시작해요. 되돌릴 수 없어요.", "새로 시작", func(): Game.new_game())
		, "Ghost", "NewGameButton"))
	else:
		v.add_child(UI.button("탐사 시작", func(): Game.new_game(), "", "NewGameButton"))
	v.add_child(UI.label("버전 %s · 콘텐츠 %d" % [ProjectSettings.get_setting("application/config/version"), int(Data.meta.get("content_version", 0))], UI.XS, _c().faint))
	return m


static func _page_margin() -> MarginContainer:
	var m := MarginContainer.new()
	for side in ["left", "right"]:
		m.add_theme_constant_override("margin_" + side, UI.PAD + 8)
	m.add_theme_constant_override("margin_top", 80)
	m.add_theme_constant_override("margin_bottom", 60)
	return m


static func _scroll(inner: Control) -> Control:
	var s := ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(inner)
	return s


# ── 기지 ──
static func base(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	var p := Data.get_item("planets", Game.state.current_planet)
	var regions := Data.regions_of(p.get("id", ""))
	var cleared := 0
	var opened := 0
	for r in regions:
		var st := _region_state(r)
		if st == "cleared":
			cleared += 1
		if st != "locked":
			opened += 1
	var prog := Game.planet_progress()

	# 개척 진행도 (큰 카드)
	var head := UI.hbox(12, [UI.label("개척 진행도", UI.S, c.muted)])
	head.add_child(UI.spacer())
	if p.get("placeholder", false):
		head.add_child(UI.placeholder_chip())
	var pct := UI.label("%d%%" % roundi(prog * 100), UI.XXL, c.text, "Display", false)
	pct.name = "ProgressValue"
	var hero := UI.card([
		head,
		UI.hbox(24, [pct, _expand(UI.vbox(2, [UI.title(p.get("name", "-"), UI.L), UI.label("지역 %d곳 중 %d곳 열림 · %d곳 개척" % [regions.size(), opened, cleared], UI.S, c.muted)]))]),
		UI.bar(prog, c.teal, 16),
	], "Card", 22)
	hero.name = "ProgressCard"
	v.add_child(hero)

	# 시설·연구 현황 (나란히)
	var fac := UI.card([UI.label("시설", UI.S, c.muted), UI.title("0", UI.XL), UI.label("행성 개척 단계에서 지을 수 있어요", UI.XS, c.faint)], "Card", 6)
	var res := UI.card([UI.label("진행 중인 연구", UI.S, c.muted), UI.title("없음", UI.XL), UI.label("연구 단계에서 열려요", UI.XS, c.faint)], "Card", 6)
	fac.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	res.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(UI.hbox(20, [fac, res]))

	# 보유 자원
	var rows := UI.vbox(14)
	for r in Data.all("resources"):
		var dot := ColorRect.new()
		dot.custom_minimum_size = Vector2(16, 16)
		dot.color = Color(r.color)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var name_l := UI.label(r.name, UI.M)
		name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var row := UI.hbox(14, [dot, name_l])
		if r.get("placeholder", false):
			row.add_child(UI.placeholder_chip())
		row.add_child(UI.label(str(Game.state.resources.get(r.id, 0)), UI.M, c.text, "Strong", false))
		rows.add_child(row)
	v.add_child(UI.vbox(14, [UI.section_head("자원", "획득처는 탐사 단계에서 열려요"), UI.card([rows])]))

	# 최근 기록
	v.add_child(UI.vbox(14, [UI.section_head("탐사 기록"), UI.card([_log_list(4)])]))
	return v


static func _log_list(n: int) -> Control:
	var list := UI.vbox(14)
	list.name = "LogList"
	var logs: Array = Game.state.log.slice(0, n)
	if logs.is_empty():
		list.add_child(UI.empty_note("아직 기록이 없어요"))
	for e in logs:
		var t := UI.label(e.text, UI.M)
		t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var when := UI.label(UI.ago(e.t), UI.XS, _c().faint, "", false)
		list.add_child(UI.hbox(16, [t, when]))
	return list


# ── 행성 ──
static func planet(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	var p := Data.get_item("planets", Game.state.current_planet)
	var regions := Data.regions_of(p.get("id", ""))
	var states := {}
	for r in regions:
		states[r.id] = _region_state(r)
	var head := UI.hbox(12, [UI.title(p.get("name", "-"), UI.XL)])
	head.get_child(0).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if p.get("placeholder", false):
		head.add_child(UI.placeholder_chip())
	v.add_child(head)
	var view := PlanetView.new()
	view.name = "PlanetView"
	view.custom_minimum_size = Vector2(0, 620)
	view.setup(p, regions, states)
	view.region_pressed.connect(func(id): main.push("region", {"id": id}, Data.get_item("regions", id).name))
	v.add_child(view)
	var legend := UI.hbox(24)
	for pair in [["열림", c.accent], ["개척 완료", c.teal], ["잠김", c.faint]]:
		var dot := ColorRect.new()
		dot.custom_minimum_size = Vector2(14, 14)
		dot.color = pair[1]
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		legend.add_child(UI.hbox(8, [dot, UI.label(pair[0], UI.XS, c.muted, "", false)]))
	legend.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(legend)

	# 환경 지표 (Phase 5)
	v.add_child(UI.vbox(14, [UI.section_head("환경 지표"), UI.card([UI.empty_note("환경 지표 종류는 아직 정해지지 않았어요.\n행성 개척 단계에서 설정 파일로 추가돼요.")])]))

	# 지역 목록
	var list := UI.vbox(14)
	list.name = "RegionList"
	for r in regions:
		list.add_child(_region_row(main, r, states[r.id]))
	v.add_child(UI.vbox(14, [UI.section_head("지역", "%d곳" % regions.size()), list]))
	return v


static func _region_row(main, r: Dictionary, st: String) -> Control:
	var c := _c()
	var b := Button.new()
	b.name = "Region_" + r.id
	b.theme_type_variation = "Flat"
	b.custom_minimum_size = Vector2(0, 120)
	b.pressed.connect(func(): main.push("region", {"id": r.id}, r.name))
	var card := PanelContainer.new()
	card.theme_type_variation = "Card"
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var icon_name: String = {"locked": "lock", "open": "explore", "cleared": "check"}[st]
	var icon_col: Color = {"locked": c.faint, "open": c.accent, "cleared": c.teal}[st]
	var texts := UI.vbox(4, [UI.title(r.name, UI.L), UI.label({"locked": unlock_text(r), "open": "탐사할 수 있어요", "cleared": "개척을 마쳤어요"}[st], UI.S, c.muted)])
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for ch in texts.get_children():
		ch.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := UI.hbox(22, [IconView.make(icon_name, 48, icon_col), texts])
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if r.get("placeholder", false):
		var ph := UI.placeholder_chip()
		ph.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(ph)
	row.add_child(IconView.make("chevron", 36, c.faint))
	card.add_child(row)
	b.add_child(card)
	b.custom_minimum_size.y = 140
	return b


static func region(main, args: Dictionary) -> Control:
	var c := _c()
	var r := Data.get_item("regions", args.get("id", ""))
	if r.is_empty():
		return UI.empty_note("지역 정보를 찾을 수 없어요")
	var st := _region_state(r)
	var v := UI.vbox(28)
	var status := UI.chip({"locked": "잠김", "open": "열림", "cleared": "개척 완료"}[st], {"locked": c.faint, "open": c.accent, "cleared": c.teal}[st])
	var chips := UI.hbox(10, [status])
	if r.get("placeholder", false):
		chips.add_child(UI.placeholder_chip())
	v.add_child(chips)
	v.add_child(UI.card([UI.label("여는 조건", UI.S, c.muted), UI.label(unlock_text(r), UI.M)], "Card", 8))
	v.add_child(UI.card([UI.label("이곳의 스테이지", UI.S, c.muted), UI.label("아직 등록된 스테이지가 없어요. 전투 단계(Phase 3)에서 추가돼요.", UI.M, c.muted)], "Card", 8))
	v.add_child(UI.card([UI.label("발견할 수 있는 개체", UI.S, c.muted), UI.label("개체 수집 단계(Phase 2)에서 이 지역의 서식 개체가 정해져요.", UI.M, c.muted)], "Card", 8))
	return v


# ── 탐사 ──
static func explore(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	v.add_child(UI.vbox(6, [UI.title("탐사", UI.XL), UI.label("열린 지역을 골라 탐사해요. 전투와 발견은 다음 단계에서 열려요.", UI.S, c.muted)]))
	var regions := Data.regions_of(Game.state.current_planet)
	var open_list := UI.vbox(14)
	open_list.name = "OpenRegions"
	var locked := 0
	for r in regions:
		var st := _region_state(r)
		if st == "locked":
			locked += 1
			continue
		open_list.add_child(_region_row(main, r, st))
	if open_list.get_child_count() == 0:
		open_list.add_child(UI.empty_note("열린 지역이 없어요"))
	v.add_child(UI.vbox(14, [UI.section_head("갈 수 있는 지역", "잠긴 지역 %d곳" % locked), open_list]))
	v.add_child(UI.card([UI.label("보스", UI.S, c.muted), UI.label("보스 전투는 전투 단계(Phase 3)에서 열려요. 보스는 다음 공격을 미리 알려 줘요.", UI.M, c.muted)], "Card", 8))
	return v


# ── 개체 ──
static func creatures(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	var total := Data.all("species").size()
	var seen: int = Game.state.collection.seen.size()
	var owned: int = Game.state.collection.owned.size()
	var stats := UI.hbox(20)
	for pair in [["도감", "%d / %d" % [seen, total]], ["보유", str(owned)]]:
		var card := UI.card([UI.label(pair[0], UI.S, c.muted), UI.title(pair[1], UI.XL)], "Card", 6)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		stats.add_child(card)
	stats.name = "CollectionStats"
	v.add_child(stats)
	# 속성 (확정된 4종)
	var els := UI.hbox(10)
	for e in Data.all("elements"):
		els.add_child(UI.chip(e.name, Color(e.color)))
	v.add_child(UI.vbox(14, [UI.section_head("속성", "상성 관계는 미정"), els]))
	# 전투 편성 5칸
	var slots := HBoxContainer.new()
	slots.name = "PartySlots"
	slots.add_theme_constant_override("separation", 14)
	for i in 5:
		var slot := PanelContainer.new()
		slot.theme_type_variation = "CardSoft"
		slot.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slot.custom_minimum_size = Vector2(0, 150)
		var l := UI.label(str(i + 1), UI.L, c.faint, "Title", false)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slot.add_child(l)
		slots.add_child(slot)
	v.add_child(UI.vbox(14, [UI.section_head("전투 편성", "최대 5개체"), slots, UI.label("개체를 발견하면 여기에 편성할 수 있어요.", UI.S, c.muted)]))
	v.add_child(UI.vbox(14, [UI.section_head("보유 개체"), UI.card([UI.empty_note("아직 발견한 개체가 없어요.\n탐사에서 야생 개체·서식지·알을 찾게 돼요.")])]))
	return v


# ── 연구 ──
static func research(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	v.add_child(UI.title("연구", UI.XL))
	for pair in [["기술 연구", "시설과 탐사 장비를 개선해요"], ["생태 연구", "개체의 생태 능력과 행성 환경을 연구해요"]]:
		v.add_child(UI.card([UI.title(pair[0], UI.L), UI.label(pair[1], UI.S, c.muted), UI.label("연구 항목은 연구 단계에서 설정 파일로 추가돼요.", UI.S, c.faint)], "Card", 8))
	v.add_child(UI.vbox(14, [UI.section_head("기록", "최근 %d개" % mini(Game.state.log.size(), 20)), UI.card([_log_list(20)])]))
	return v


# ── 설정 ──
static func settings(main) -> Control:
	var c := _c()
	var v := UI.vbox(28)
	# 화면 모드
	var modes := UI.hbox(14)
	modes.name = "ThemeModes"
	for pair in [["dark", "어둡게"], ["light", "밝게"]]:
		var on: bool = Game.settings.theme == pair[0]
		var b := UI.button(pair[1], func(): Game.set_theme(pair[0]), "" if on else "Ghost", "Theme_" + pair[0])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		modes.add_child(b)
	v.add_child(UI.vbox(14, [UI.section_head("화면 모드"), modes]))

	# 저장
	var last := "아직 저장 전" if Save.last_saved_at == 0 else UI.ago(Save.last_saved_at)
	var save_box := UI.vbox(16, [
		UI.label("진행 상황은 바뀔 때마다 이 기기에 자동 저장돼요. 마지막 저장: %s" % last, UI.S, c.muted),
	])
	var row := UI.hbox(14)
	var ex := UI.button("내보내기", func(): _export_sheet(main), "Ghost", "ExportButton")
	var im := UI.button("가져오기", func(): _import_sheet(main), "Ghost", "ImportButton")
	ex.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	im.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(ex)
	row.add_child(im)
	save_box.add_child(row)
	save_box.add_child(UI.button("처음부터 다시", func():
		main.confirm("처음부터 다시 할까요?", "모든 탐사 기록이 지워져요. 되돌릴 수 없어요.", "모두 지우기", func(): Game.reset())
	, "Ghost", "ResetButton"))
	v.add_child(UI.vbox(14, [UI.section_head("저장 데이터"), UI.card([save_box])]))

	# 콘텐츠 정보 (임시 데이터 현황)
	var info := UI.vbox(10, [
		UI.label("게임 버전 %s · 콘텐츠 버전 %d" % [ProjectSettings.get_setting("application/config/version"), int(Data.meta.get("content_version", 0))], UI.S),
		UI.label("확정된 설정: 기본 속성 4종 (%s)" % ", ".join(Data.all("elements").map(func(e): return e.name)), UI.S),
		UI.label("임시(미확정) 항목 %d개 — 이름·수치는 설정 파일에서 바꿔요" % Data.placeholder_count(), UI.S, c.warn),
	])
	info.name = "ContentInfo"
	v.add_child(UI.vbox(14, [UI.section_head("콘텐츠"), UI.card([info])]))
	return v


static func _export_sheet(main) -> void:
	var text := Game.export_text()
	main.open_sheet(func(box: VBoxContainer, close: Callable):
		box.add_child(UI.title("저장 데이터 내보내기", UI.XL))
		var te := TextEdit.new()
		te.name = "ExportText"
		te.text = text
		te.editable = false
		te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		te.custom_minimum_size = Vector2(0, 260)
		box.add_child(te)
		var note := UI.label("이 글자 전체가 저장 데이터예요. 복사해서 안전한 곳에 보관하세요. (%d KB)" % ceili(text.length() / 1024.0), UI.S, Palette.c.muted)
		box.add_child(note)
		var row := UI.hbox(16)
		var cl := UI.button("닫기", func(): close.call(null), "Ghost")
		var cp := UI.button("복사하기", func():
			DisplayServer.clipboard_set(text)
			note.text = "복사했어요. 메모 앱 등에 붙여 넣어 보관하세요.")
		cl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(cl)
		row.add_child(cp)
		box.add_child(row))


static func _import_sheet(main) -> void:
	main.open_sheet(func(box: VBoxContainer, close: Callable):
		box.add_child(UI.title("저장 데이터 가져오기", UI.XL))
		var te := TextEdit.new()
		te.name = "ImportText"
		te.placeholder_text = "내보낸 글자를 여기에 붙여 넣어 주세요"
		te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		te.custom_minimum_size = Vector2(0, 260)
		box.add_child(te)
		var status := UI.label("가져오면 지금 기록은 가져온 기록으로 바뀌어요.", UI.S, Palette.c.warn)
		status.name = "ImportStatus"
		box.add_child(status)
		var row := UI.hbox(16)
		var cl := UI.button("취소", func(): close.call(null), "Ghost")
		var go := UI.button("가져오기", func():
			if te.text.strip_edges() == "":
				status.text = "붙여 넣은 글자가 없어요."
				return
			var r := Game.import_text(te.text)
			if r.has("error"):
				status.text = r.error
				return
			close.call(true)
			main.toast("기록을 가져왔어요")
		, "Danger", "ImportGo")
		cl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(cl)
		row.add_child(go)
		box.add_child(row))
