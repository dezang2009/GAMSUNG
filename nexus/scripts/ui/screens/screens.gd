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
		"dex":
			return dex(main)
		"species":
			return species(main, args)
		"creature":
			return creature(main, args)
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
	var m = _page_margin()
	var v = UI.vbox(20)
	m.add_child(v)
	v.add_child(UI.title("설정 데이터 오류", UI.XL))
	v.add_child(UI.label("res://data 의 설정 파일에 문제가 있어 게임을 시작하지 않았어요. 아래를 고친 뒤 다시 실행해 주세요.", UI.M, _c().muted))
	var list = UI.vbox(10)
	list.name = "ErrorList"
	for e in Data.errors:
		list.add_child(UI.label("· " + e, UI.S, _c().danger))
	v.add_child(UI.card([list]))
	return _scroll(m)


# ── 첫 화면 ──
static func title(main) -> Control:
	var m = _page_margin()
	var v = UI.vbox(28)
	v.alignment = BoxContainer.ALIGNMENT_END
	m.add_child(v)
	m.add_theme_constant_override("margin_bottom", 120)
	var logo = UI.label("NEXUS", 132, _c().text, "Display")
	v.add_child(logo)
	v.add_child(UI.label("미지의 행성을 탐사하고, 생명체를 발견하고, 행성을 되살리는 이야기", UI.M, _c().muted))
	var tags = UI.hbox(10)
	for e in Data.all("elements"):
		tags.add_child(UI.chip(e.name, Color(e.color)))
	v.add_child(tags)
	v.add_child(UI.spacer(40))
	if Save.has_save():
		var cont = UI.button("이어서 탐사하기", func():
			var r = Game.load_saved()
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
	var m = MarginContainer.new()
	for side in ["left", "right"]:
		m.add_theme_constant_override("margin_" + side, UI.PAD + 8)
	m.add_theme_constant_override("margin_top", 80)
	m.add_theme_constant_override("margin_bottom", 60)
	return m


static func _scroll(inner: Control) -> Control:
	var s = ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(inner)
	return s


# ── 기지 ──
static func base(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	var p = Data.get_item("planets", Game.state.current_planet)
	var regions = Data.regions_of(p.get("id", ""))
	var cleared = 0
	var opened = 0
	for r in regions:
		var st = _region_state(r)
		if st == "cleared":
			cleared += 1
		if st != "locked":
			opened += 1
	var prog = Game.planet_progress()

	# 개척 진행도 (큰 카드)
	var head = UI.hbox(12, [UI.label("개척 진행도", UI.S, c.muted)])
	head.add_child(UI.spacer())
	if p.get("placeholder", false):
		head.add_child(UI.placeholder_chip())
	var pct = UI.label("%d%%" % roundi(prog * 100), UI.XXL, c.text, "Display", false)
	pct.name = "ProgressValue"
	var hero = UI.card([
		head,
		UI.hbox(24, [pct, _expand(UI.vbox(2, [UI.title(p.get("name", "-"), UI.L), UI.label("지역 %d곳 중 %d곳 열림 · %d곳 개척" % [regions.size(), opened, cleared], UI.S, c.muted)]))]),
		UI.bar(prog, c.teal, 16),
	], "Card", 22)
	hero.name = "ProgressCard"
	v.add_child(hero)

	# 시설·연구 현황 (나란히)
	var fac = UI.card([UI.label("시설", UI.S, c.muted), UI.title("0", UI.XL), UI.label("행성 개척 단계에서 지을 수 있어요", UI.XS, c.faint)], "Card", 6)
	var res = UI.card([UI.label("진행 중인 연구", UI.S, c.muted), UI.title("없음", UI.XL), UI.label("연구 단계에서 열려요", UI.XS, c.faint)], "Card", 6)
	fac.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	res.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(UI.hbox(20, [fac, res]))

	# 보유 자원
	var rows = UI.vbox(14)
	for r in Data.all("resources"):
		var dot = ColorRect.new()
		dot.custom_minimum_size = Vector2(16, 16)
		dot.color = Color(r.color)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var name_l = UI.label(r.name, UI.M)
		name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var row = UI.hbox(14, [dot, name_l])
		if r.get("placeholder", false):
			row.add_child(UI.placeholder_chip())
		row.add_child(UI.label(str(Game.state.resources.get(r.id, 0)), UI.M, c.text, "Strong", false))
		rows.add_child(row)
	v.add_child(UI.vbox(14, [UI.section_head("자원", "획득처는 탐사 단계에서 열려요"), UI.card([rows])]))

	# 최근 기록
	v.add_child(UI.vbox(14, [UI.section_head("탐사 기록"), UI.card([_log_list(4)])]))
	return v


static func _log_list(n: int) -> Control:
	var list = UI.vbox(14)
	list.name = "LogList"
	var logs: Array = Game.state.log.slice(0, n)
	if logs.is_empty():
		list.add_child(UI.empty_note("아직 기록이 없어요"))
	for e in logs:
		var t = UI.label(e.text, UI.M)
		t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var when = UI.label(UI.ago(e.t), UI.XS, _c().faint, "", false)
		list.add_child(UI.hbox(16, [t, when]))
	return list


# ── 행성 ──
static func planet(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	var p = Data.get_item("planets", Game.state.current_planet)
	var regions = Data.regions_of(p.get("id", ""))
	var states = {}
	for r in regions:
		states[r.id] = _region_state(r)
	var head = UI.hbox(12, [UI.title(p.get("name", "-"), UI.XL)])
	head.get_child(0).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if p.get("placeholder", false):
		head.add_child(UI.placeholder_chip())
	v.add_child(head)
	var view = PlanetView.new()
	view.name = "PlanetView"
	view.custom_minimum_size = Vector2(0, 620)
	view.setup(p, regions, states)
	view.region_pressed.connect(func(id): main.push("region", {"id": id}, Data.get_item("regions", id).name))
	v.add_child(view)
	var legend = UI.hbox(24)
	for pair in [["열림", c.accent], ["개척 완료", c.teal], ["잠김", c.faint]]:
		var dot = ColorRect.new()
		dot.custom_minimum_size = Vector2(14, 14)
		dot.color = pair[1]
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		legend.add_child(UI.hbox(8, [dot, UI.label(pair[0], UI.XS, c.muted, "", false)]))
	legend.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(legend)

	# 환경 지표 (Phase 5)
	v.add_child(UI.vbox(14, [UI.section_head("환경 지표"), UI.card([UI.empty_note("환경 지표 종류는 아직 정해지지 않았어요.\n행성 개척 단계에서 설정 파일로 추가돼요.")])]))

	# 지역 목록
	var list = UI.vbox(14)
	list.name = "RegionList"
	for r in regions:
		list.add_child(_region_row(main, r, states[r.id]))
	v.add_child(UI.vbox(14, [UI.section_head("지역", "%d곳" % regions.size()), list]))
	return v


static func _region_row(main, r: Dictionary, st: String) -> Control:
	var c = _c()
	var b = Button.new()
	b.name = "Region_" + r.id
	b.theme_type_variation = "Flat"
	b.custom_minimum_size = Vector2(0, 120)
	b.pressed.connect(func(): main.push("region", {"id": r.id}, r.name))
	var card = PanelContainer.new()
	card.theme_type_variation = "Card"
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var icon_name: String = {"locked": "lock", "open": "explore", "cleared": "check"}[st]
	var icon_col: Color = {"locked": c.faint, "open": c.accent, "cleared": c.teal}[st]
	var sub: String = {"locked": unlock_text(r), "open": "탐사할 수 있어요", "cleared": "개척을 마쳤어요"}[st]
	if st != "locked" and int(r.get("surveys", 0)) > 0:
		sub += " · 조사 %d/%d" % [ExplorationSystem.done(Game.state, r.id), int(r.surveys)]
	var texts = UI.vbox(4, [UI.title(r.name, UI.L), UI.label(sub, UI.S, c.muted)])
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for ch in texts.get_children():
		ch.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row = UI.hbox(22, [IconView.make(icon_name, 48, icon_col), texts])
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if r.get("placeholder", false):
		var ph = UI.placeholder_chip()
		ph.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(ph)
	row.add_child(IconView.make("chevron", 36, c.faint))
	card.add_child(row)
	b.add_child(card)
	b.custom_minimum_size.y = 140
	return b


static func region(main, args: Dictionary) -> Control:
	var c = _c()
	var r = Data.get_item("regions", args.get("id", ""))
	if r.is_empty():
		return UI.empty_note("지역 정보를 찾을 수 없어요")
	var st = _region_state(r)
	var v = UI.vbox(24)
	var status = UI.chip({"locked": "잠김", "open": "열림", "cleared": "개척 완료"}[st], {"locked": c.faint, "open": c.accent, "cleared": c.teal}[st])
	var chips = UI.hbox(10, [status])
	if r.get("placeholder", false):
		chips.add_child(UI.placeholder_chip())
	v.add_child(chips)
	if st == "locked":
		v.add_child(UI.card([UI.label("여는 조건", UI.S, c.muted), UI.label(unlock_text(r), UI.M)], "Card", 8))

	# 조사
	var done = ExplorationSystem.done(Game.state, r.id)
	var total = int(r.get("surveys", 0))
	var why = ExplorationSystem.blocked_reason(Game.state, r, Game.is_region_unlocked(r))
	var sbox = UI.vbox(14)
	sbox.add_child(UI.hbox(12, [UI.title("지역 조사", UI.L, false), UI.spacer(), UI.label("%d / %d" % [done, total], UI.M, c.text, "Strong", false)]))
	sbox.add_child(UI.bar(float(done) / maxi(1, total), c.teal, 12))
	sbox.add_child(UI.label("조사할 때마다 야생 개체를 목격하거나 알을 찾아요. 깊이 조사할수록 새로운 서식지가 드러나요.", UI.S, c.muted))
	var go = UI.button("조사하기 (%d차)" % (done + 1) if why == "" else why, func(): _do_survey(main, r.id), "" if why == "" else "Ghost", "SurveyButton")
	go.disabled = why != ""
	sbox.add_child(go)
	var scard = UI.card([sbox])
	scard.name = "SurveyCard"
	v.add_child(scard)

	# 이곳의 개체 (드러난 서식지만)
	var grid = GridContainer.new()
	grid.name = "RegionCreatures"
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	var hidden = 0
	for e in r.get("encounters", []):
		if int(e.from_survey) > maxi(done, 1):
			hidden += 1
			continue
		var stt = CollectionSystem.status(Game.state, e.species)
		var sp = Data.get_item("species", e.species)
		var cell = UI.vbox(4, [CreatureArt.make(e.species, stt, 120)])
		var nm = UI.label(sp.name if stt != "unknown" else "???", UI.XS, c.text if stt != "unknown" else c.faint, "Strong", false)
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cell.add_child(nm)
		var how = UI.label("알" if e.method == "egg" else "야생", UI.XS, c.muted, "", false)
		how.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cell.add_child(how)
		grid.add_child(cell)
	var cbody = UI.vbox(12, [grid])
	if hidden > 0:
		cbody.add_child(UI.label("더 조사하면 드러나는 서식지 %d곳이 있어요" % hidden, UI.S, c.muted))
	v.add_child(UI.vbox(14, [UI.section_head("이곳의 개체", "목격 전에는 ???"), UI.card([cbody])]))
	v.add_child(UI.card([UI.label("이곳의 스테이지", UI.S, c.muted), UI.label("전투 스테이지는 전투 단계(Phase 3)에서 추가돼요. 야생 개체 확보도 전투로 해요.", UI.M, c.muted)], "Card", 8))
	return v


static func _do_survey(main, region_id: String) -> void:
	var res: Dictionary = Game.survey_region(region_id)
	if res.has("error"):
		main.toast(res.error, true)
		return
	var r = Data.get_item("regions", region_id)
	main.open_sheet(func(box: VBoxContainer, close: Callable):
		box.name = "SurveyResult"
		box.add_child(UI.title("%s · %d차 조사" % [r.name, res.survey], UI.XL))
		if res.results.is_empty():
			box.add_child(UI.label("이번에는 아무것도 만나지 못했어요.", UI.M, Palette.c.muted))
		for x in res.results:
			var sp = Data.get_item("species", x.species)
			var head = ""
			var sub = ""
			if x.type == "egg":
				head = "알을 찾았어요!" if x.acquire.kind == "new" else "이미 가진 개체의 알"
				sub = "%s 확보 · 연구 데이터 +%d" % [sp.name, x.acquire.research] if x.acquire.kind == "new" else "%s · 중복이라 연구 데이터 +%d 로 바꿨어요" % [sp.name, x.acquire.research]
			else:
				head = "새 개체 목격!" if x.new else "다시 목격"
				sub = "%s · 도감 등록 · 연구 데이터 +%d" % [sp.name, int(Data.research_config().sighting)] if x.new else "%s · 연구 데이터 +%d" % [sp.name, int(Data.research_config().sighting)]
			var t = UI.vbox(2, [UI.label(head, UI.M, Palette.c.accent if x.new or (x.type == "egg" and x.acquire.kind == "new") else Palette.c.text, "Strong"), UI.label(sub, UI.S, Palette.c.muted)])
			t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			box.add_child(UI.hbox(18, [CreatureArt.make(x.species, CollectionSystem.status(Game.state, x.species), 110), t]))
		box.add_child(UI.button("확인", func(): close.call(true), "", "SurveyOk")))


# ── 탐사 ──
static func explore(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	v.add_child(UI.vbox(6, [UI.title("탐사", UI.XL), UI.label("열린 지역을 골라 조사해요. 야생 개체를 목격하고 알을 찾을 수 있어요. 전투는 다음 단계에서 열려요.", UI.S, c.muted)]))
	var regions = Data.regions_of(Game.state.current_planet)
	var open_list = UI.vbox(14)
	open_list.name = "OpenRegions"
	var locked = 0
	for r in regions:
		var st = _region_state(r)
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
const METHOD_TEXT := {"start": "함께 출발", "egg": "알 발견", "wild": "야생 목격", "battle": "전투", "boss": "보스", "research": "연구", "evolution": "진화"}


static func _el_chip(sp: Dictionary) -> Control:
	var e = Data.get_item("elements", sp.get("element", ""))
	return UI.chip(e.get("name", "?"), Color(e.get("color", "#888888")))


static func _rarity_chip(sp: Dictionary) -> Control:
	var r = Data.get_item("rarities", sp.get("rarity", ""))
	return UI.chip(r.get("name", "?"), Color(r.get("color", "#888888")))


## 누를 수 있는 카드 (Flat 버튼 + 카드 모양)
static func _tap_card(name: String, on_press: Callable, content: Control, variation := "Card", min_h := 0) -> Button:
	var b = Button.new()
	b.name = name
	b.theme_type_variation = "Flat"
	b.focus_mode = Control.FOCUS_ALL
	b.pressed.connect(on_press)
	var card = PanelContainer.new()
	card.theme_type_variation = variation
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ignore_mouse(content)
	card.add_child(content)
	b.add_child(card)
	b.custom_minimum_size = Vector2(UI.TOUCH, maxf(min_h, UI.TOUCH))
	card.minimum_size_changed.connect(func(): b.custom_minimum_size.y = maxf(card.get_combined_minimum_size().y, maxf(min_h, UI.TOUCH)))
	b.custom_minimum_size.y = maxf(card.get_combined_minimum_size().y, maxf(min_h, UI.TOUCH))
	return b


static func _ignore_mouse(n: Node) -> void:
	if n is Control:
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for ch in n.get_children():
		_ignore_mouse(ch)


static func creatures(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	var cnt = CollectionSystem.counts(Game.state)
	# 도감 카드 (누르면 도감)
	var dex_inner = UI.hbox(20)
	var arts = Control.new()
	arts.custom_minimum_size = Vector2(170, 110)
	var shown = 0
	for sp in Data.all("species"):
		if shown >= 3:
			break
		var st = CollectionSystem.status(Game.state, sp.id)
		var a = CreatureArt.make(sp.id, st, 100)
		a.position = Vector2(shown * 34, 4)
		arts.add_child(a)
		shown += 1
	dex_inner.add_child(arts)
	var dex_text = UI.vbox(4, [UI.label("도감", UI.S, c.muted), UI.title("%d / %d" % [cnt.seen, cnt.total], UI.XL, false), UI.label("확보 %d종" % cnt.owned_species, UI.S, c.muted)])
	dex_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dex_inner.add_child(dex_text)
	dex_inner.add_child(IconView.make("chevron", 36, c.faint))
	var dex = _tap_card("DexCard", func(): main.push("dex", {}, "도감"), dex_inner)
	v.add_child(dex)

	# 전투 편성 5칸 (편성은 전투 단계에서)
	var slots = HBoxContainer.new()
	slots.name = "PartySlots"
	slots.add_theme_constant_override("separation", 14)
	for i in 5:
		var slot = PanelContainer.new()
		slot.theme_type_variation = "CardSoft"
		slot.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slot.custom_minimum_size = Vector2(0, 120)
		var l = UI.label(str(i + 1), UI.L, c.faint, "Title", false)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slot.add_child(l)
		slots.add_child(slot)
	v.add_child(UI.vbox(14, [UI.section_head("전투 편성", "최대 5개체"), slots, UI.label("편성은 전투 단계(Phase 3)에서 열려요.", UI.S, c.muted)]))

	# 보유 개체: 속성 거르기 + 정렬
	var ui: Dictionary = main.ui
	var filt: String = ui.get("el_filter", "")
	var sort: String = ui.get("sort", "recent")
	var chips = HFlowContainer.new()
	chips.name = "ElementFilter"
	chips.add_theme_constant_override("h_separation", 10)
	chips.add_theme_constant_override("v_separation", 10)
	var opts = [["", "전체"]]
	for e in Data.all("elements"):
		opts.append([e.id, e.name])
	for o in opts:
		var on: bool = filt == o[0]
		var b = UI.button(o[1], func(): ui["el_filter"] = o[0]; main.render(), "" if on else "Ghost", "Filter_" + (o[0] if o[0] != "" else "all"))
		b.custom_minimum_size = Vector2(UI.TOUCH + 20, UI.TOUCH)
		chips.add_child(b)
	var sort_names = {"recent": "최근", "rarity": "희귀도", "name": "이름"}
	var next_sort: String = {"recent": "rarity", "rarity": "name", "name": "recent"}[sort]
	var sort_btn = UI.button("정렬: %s" % sort_names[sort], func(): ui["sort"] = next_sort; main.render(), "Ghost", "SortButton")
	var list = CollectionSystem.owned_list(Game.state, filt, sort)
	var grid = GridContainer.new()
	grid.name = "OwnedGrid"
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 18)
	for it in list:
		var sp = Data.get_item("species", it.species)
		var inner = UI.vbox(10)
		var art = CreatureArt.make(it.species, "owned", 220)
		art.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		inner.add_child(art)
		inner.add_child(UI.title(CollectionSystem.display_name(it), UI.M, false))
		inner.add_child(UI.hbox(8, [_el_chip(sp), UI.label("Lv %d" % it.level, UI.S, c.muted, "Strong", false)]))
		var card = _tap_card("Owned_" + it.uid, func(): main.push("creature", {"uid": it.uid}, CollectionSystem.display_name(it)), inner)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(card)
	var head = UI.hbox(12, [UI.title("보유 개체", UI.L, false), UI.label("%d" % list.size(), UI.S, c.muted, "", false)])
	head.add_child(UI.spacer())
	head.add_child(sort_btn)
	v.add_child(UI.vbox(16, [head, chips, grid if not list.is_empty() else UI.card([UI.empty_note("이 속성의 개체가 없어요" if filt != "" else "아직 확보한 개체가 없어요")])]))
	return v


## 도감: 모든 종 (모름은 실루엣)
static func dex(main) -> Control:
	var c = _c()
	var v = UI.vbox(24)
	var cnt = CollectionSystem.counts(Game.state)
	v.add_child(UI.label("목격 %d · 확보 %d종 · 전체 %d종. 목격하거나 확보하면 연구 데이터가 쌓여 정보가 열려요." % [cnt.seen, cnt.owned_species, cnt.total], UI.S, c.muted))
	var grid = GridContainer.new()
	grid.name = "DexGrid"
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	for sp in Data.all("species"):
		var st = CollectionSystem.status(Game.state, sp.id)
		var inner = UI.vbox(6)
		var art = CreatureArt.make(sp.id, st, 150)
		art.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		inner.add_child(art)
		var no = sp.id.trim_prefix("sp_")
		var nm = UI.label(("No.%s  %s" % [no, sp.name]) if st != "unknown" else "No.%s  ???" % no, UI.XS, c.text if st != "unknown" else c.faint, "Strong", false)
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nm.clip_text = true
		inner.add_child(nm)
		inner.add_child(_research_dots(CollectionSystem.research_level(Game.state, sp.id)))
		var cell: Control
		if st == "unknown":
			var p = PanelContainer.new()
			p.theme_type_variation = "CardSoft"
			p.name = "Dex_" + sp.id
			p.add_child(inner)
			cell = p
		else:
			cell = _tap_card("Dex_" + sp.id, func(): main.push("species", {"id": sp.id}, sp.name), inner, "CardSoft")
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(cell)
	v.add_child(grid)
	return v


static func _research_dots(lv: int) -> Control:
	var h = UI.hbox(6)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	for i in CollectionSystem.research_max():
		var d = ColorRect.new()
		d.custom_minimum_size = Vector2(22, 8)
		d.color = _c().teal if i < lv else Color(_c().text, 0.12)
		h.add_child(d)
	return h


## 종 상세 (도감): 연구 단계에 따라 공개
static func species(main, args: Dictionary) -> Control:
	var c = _c()
	var sp = Data.get_item("species", args.get("id", ""))
	if sp.is_empty():
		return UI.empty_note("개체 정보를 찾을 수 없어요")
	var st = CollectionSystem.status(Game.state, sp.id)
	var lv = CollectionSystem.research_level(Game.state, sp.id)
	var pts = CollectionSystem.research_points(Game.state, sp.id)
	var need = CollectionSystem.next_level_need(Game.state, sp.id)
	var v = UI.vbox(24)
	var art = CreatureArt.make(sp.id, st, 340, true)
	art.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	art.name = "SpeciesArt"
	v.add_child(art)
	var chips = UI.hbox(10, [UI.chip({"seen": "목격", "owned": "확보", "unknown": "모름"}[st], c.accent if st == "owned" else c.muted), _el_chip(sp), _rarity_chip(sp)])
	if sp.get("placeholder", false):
		chips.add_child(UI.placeholder_chip())
	v.add_child(chips)
	# 연구 데이터
	var rbox = UI.vbox(10, [UI.hbox(10, [UI.label("연구 %d단계" % lv, UI.M, c.text, "Strong"), UI.label("%d점%s" % [pts, (" · 다음 단계 %d점" % need) if need > 0 else " · 최고 단계"], UI.S, c.muted, "", false)])])
	var max_need: float = float(Data.research_config().levels.back())
	rbox.add_child(UI.bar(minf(1.0, pts / max_need), c.teal, 14))
	rbox.add_child(UI.label("목격 +%d · 확보 +%d · 중복 확보 +%d" % [int(Data.research_config().sighting), int(Data.research_config().owned), int(Data.research_config().duplicate)], UI.XS, c.faint))
	var rcard = UI.card([rbox])
	rcard.name = "ResearchCard"
	v.add_child(rcard)
	# 서식지 (1단계)
	var hab = UI.vbox(10)
	var hs = CollectionSystem.habitats(sp.id)
	if CollectionSystem.evolution_only(sp.id):
		hab.add_child(UI.label("야생에서는 만날 수 없어요. 진화로 얻어요.", UI.M))
	for hh in hs:
		var r = Data.get_item("regions", hh.region)
		hab.add_child(UI.label("%s · %s · %d차 조사부터" % [r.name, {"wild": "야생 목격", "egg": "알 발견"}[hh.method], hh.from_survey], UI.M))
	if sp.id in Data.meta.get("starting_creatures", []):
		hab.add_child(UI.label("탐사를 시작할 때 함께 출발해요", UI.M))
	v.add_child(_gated("서식지", 1, lv, hab))
	# 능력치 (2단계)
	v.add_child(_gated("기본 능력치", 2, lv, _stat_rows(sp.base_stats)))
	# 생태 능력·진화 (3단계)
	var eco = UI.vbox(10)
	for eid in sp.eco_abilities:
		var e = Data.get_item("eco_abilities", eid)
		eco.add_child(UI.label("%s — %s" % [e.name, e.desc], UI.M))
	v.add_child(_gated("생태 능력", 3, lv, eco))
	v.add_child(_gated("진화", 3, lv, _evolution_view(sp.id)))
	return v


static func _gated(title: String, need_lv: int, lv: int, body: Control) -> Control:
	var c = _c()
	var head = UI.hbox(10, [UI.label(title, UI.S, c.muted)])
	if lv < need_lv:
		head.add_child(IconView.make("lock", 32, c.faint))
		return UI.card([head, UI.label("연구 %d단계에서 공개돼요" % need_lv, UI.M, c.faint)], "Card", 8)
	return UI.card([head, body], "Card", 12)


static func _stat_rows(stats: Dictionary) -> Control:
	var c = _c()
	var box = UI.vbox(12)
	box.name = "StatRows"
	for st in Data.all("stats"):
		var val = int(stats.get(st.id, 0))
		var name_l = UI.label(st.name, UI.S, c.muted, "", false)
		name_l.custom_minimum_size = Vector2(90, 0)
		var b = UI.bar(minf(1.0, val / 100.0), c.accent, 12)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var num = UI.label(str(val), UI.M, c.text, "Strong", false)
		num.custom_minimum_size = Vector2(60, 0)
		num.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		box.add_child(UI.hbox(16, [name_l, b, num]))
	return box


## 진화 경로: 단계별 줄, 분기는 한 줄에 나란히
static func _evolution_view(species_id: String) -> Control:
	var c = _c()
	var box = UI.vbox(10)
	box.name = "EvolutionView"
	var line = CollectionSystem.evolution_line(species_id)
	var by_stage = {}
	for s in line:
		by_stage.get_or_add(int(s.evolution.stage), []).append(s)
	var stages = by_stage.keys()
	stages.sort()
	for stg in stages:
		var row = UI.hbox(12, [UI.label("%d단계" % stg, UI.XS, c.faint, "", false)])
		for s in by_stage[stg]:
			var st = CollectionSystem.status(Game.state, s.id)
			var a = CreatureArt.make(s.id, st, 84)
			var nm = UI.label(s.name if st != "unknown" else "???", UI.XS, c.text if s.id == species_id else c.muted, "Strong", false)
			row.add_child(UI.vbox(2, [a, nm]))
		box.add_child(row)
	var sp = Data.get_item("species", species_id)
	var nexts: Array = sp.evolution.next
	if nexts.size() > 1:
		box.add_child(UI.label("이 개체는 %d갈래로 진화할 수 있어요 (분기 진화). 조건은 미정이에요." % nexts.size(), UI.S, c.warn))
	elif nexts.size() == 1:
		box.add_child(UI.label("다음 단계로 진화할 수 있어요. 조건은 미정 (육성 단계에서 정해져요).", UI.S, c.muted))
	else:
		box.add_child(UI.label("마지막 단계예요.", UI.S, c.muted))
	return box


## 보유 개체 상세
static func creature(main, args: Dictionary) -> Control:
	var c = _c()
	var it = CollectionSystem.instance(Game.state, args.get("uid", ""))
	if it.is_empty():
		return UI.empty_note("개체를 찾을 수 없어요")
	var sp = Data.get_item("species", it.species)
	var v = UI.vbox(24)
	var art = CreatureArt.make(it.species, "owned", 360, true)
	art.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	art.name = "CreatureArt"
	v.add_child(art)
	var role = Data.get_item("roles", sp.role)
	var chips = UI.hbox(10, [_el_chip(sp), _rarity_chip(sp), UI.chip(role.get("name", "?"), c.muted)])
	if sp.get("placeholder", false):
		chips.add_child(UI.placeholder_chip())
	v.add_child(chips)
	# 레벨
	var lvbox = UI.vbox(10, [UI.hbox(12, [UI.title("Lv %d" % it.level, UI.XL, false), UI.label("경험치 %d" % it.exp, UI.S, c.muted, "", false)]), UI.bar(0.0, c.accent, 12), UI.label("레벨과 경험치는 전투·육성 단계에서 오르기 시작해요.", UI.XS, c.faint)])
	v.add_child(UI.card([lvbox]))
	# 능력치
	var stats = UI.card([UI.label("능력치", UI.S, c.muted), _stat_rows(CollectionSystem.stats_of(it))], "Card", 12)
	stats.name = "StatsCard"
	v.add_child(stats)
	# 특성·생태 능력
	var tr = UI.vbox(10, [UI.label("고유 특성", UI.S, c.muted)])
	for tid in sp.traits:
		var t = Data.get_item("traits", tid)
		tr.add_child(UI.label("%s — %s" % [t.name, t.desc], UI.M))
	tr.add_child(UI.label("생태 능력 (행성에 주는 영향)", UI.S, c.muted))
	for eid in sp.eco_abilities:
		var e = Data.get_item("eco_abilities", eid)
		tr.add_child(UI.label("%s — %s" % [e.name, e.desc], UI.M))
	v.add_child(UI.card([tr]))
	# 스킬
	v.add_child(UI.card([UI.label("스킬", UI.S, c.muted), UI.label("스킬은 전투 단계(Phase 3)에서 정해져요." if sp.skills.is_empty() else ", ".join(sp.skills), UI.M, c.muted)], "Card", 8))
	# 진화
	v.add_child(UI.card([UI.label("진화 경로", UI.S, c.muted), _evolution_view(it.species)], "Card", 12))
	# 얻은 곳
	var where: String = Data.get_item("regions", it.region).get("name", "") if it.region != "" else ""
	v.add_child(UI.card([UI.label("얻은 방법", UI.S, c.muted), UI.label("%s%s · %s" % [METHOD_TEXT.get(it.method, it.method), (" · " + where) if where != "" else "", Time.get_date_string_from_unix_time(int(it.obtained_at))], UI.M)], "Card", 8))
	v.add_child(UI.button("도감에서 보기 (연구 %d단계)" % CollectionSystem.research_level(Game.state, it.species), func(): main.push("species", {"id": it.species}, sp.name), "Ghost", "OpenSpecies"))
	return v


# ── 연구 ──
static func research(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	v.add_child(UI.title("연구", UI.XL))
	for pair in [["기술 연구", "시설과 탐사 장비를 개선해요"], ["생태 연구", "개체의 생태 능력과 행성 환경을 연구해요"]]:
		v.add_child(UI.card([UI.title(pair[0], UI.L), UI.label(pair[1], UI.S, c.muted), UI.label("연구 항목은 연구 단계에서 설정 파일로 추가돼요.", UI.S, c.faint)], "Card", 8))
	v.add_child(UI.vbox(14, [UI.section_head("기록", "최근 %d개" % mini(Game.state.log.size(), 20)), UI.card([_log_list(20)])]))
	return v


# ── 설정 ──
static func settings(main) -> Control:
	var c = _c()
	var v = UI.vbox(28)
	# 화면 모드
	var modes = UI.hbox(14)
	modes.name = "ThemeModes"
	for pair in [["dark", "어둡게"], ["light", "밝게"]]:
		var on: bool = Game.settings.theme == pair[0]
		var b = UI.button(pair[1], func(): Game.set_theme(pair[0]), "" if on else "Ghost", "Theme_" + pair[0])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		modes.add_child(b)
	v.add_child(UI.vbox(14, [UI.section_head("화면 모드"), modes]))

	# 저장
	var last = "아직 저장 전" if Save.last_saved_at == 0 else UI.ago(Save.last_saved_at)
	var save_box = UI.vbox(16, [
		UI.label("진행 상황은 바뀔 때마다 이 기기에 자동 저장돼요. 마지막 저장: %s" % last, UI.S, c.muted),
	])
	var row = UI.hbox(14)
	var ex = UI.button("내보내기", func(): _export_sheet(main), "Ghost", "ExportButton")
	var im = UI.button("가져오기", func(): _import_sheet(main), "Ghost", "ImportButton")
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
	var info = UI.vbox(10, [
		UI.label("게임 버전 %s · 콘텐츠 버전 %d" % [ProjectSettings.get_setting("application/config/version"), int(Data.meta.get("content_version", 0))], UI.S),
		UI.label("확정된 설정: 기본 속성 4종 (%s)" % ", ".join(Data.all("elements").map(func(e): return e.name)), UI.S),
		UI.label("임시(미확정) 항목 %d개 — 이름·수치는 설정 파일에서 바꿔요" % Data.placeholder_count(), UI.S, c.warn),
	])
	info.name = "ContentInfo"
	v.add_child(UI.vbox(14, [UI.section_head("콘텐츠"), UI.card([info])]))
	return v


static func _export_sheet(main) -> void:
	var text = Game.export_text()
	main.open_sheet(func(box: VBoxContainer, close: Callable):
		box.add_child(UI.title("저장 데이터 내보내기", UI.XL))
		var te = TextEdit.new()
		te.name = "ExportText"
		te.text = text
		te.editable = false
		te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		te.custom_minimum_size = Vector2(0, 260)
		box.add_child(te)
		var note = UI.label("이 글자 전체가 저장 데이터예요. 복사해서 안전한 곳에 보관하세요. (%d KB)" % ceili(text.length() / 1024.0), UI.S, Palette.c.muted)
		box.add_child(note)
		var row = UI.hbox(16)
		var cl = UI.button("닫기", func(): close.call(null), "Ghost")
		var cp = UI.button("복사하기", func():
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
		var te = TextEdit.new()
		te.name = "ImportText"
		te.placeholder_text = "내보낸 글자를 여기에 붙여 넣어 주세요"
		te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		te.custom_minimum_size = Vector2(0, 260)
		box.add_child(te)
		var status = UI.label("가져오면 지금 기록은 가져온 기록으로 바뀌어요.", UI.S, Palette.c.warn)
		status.name = "ImportStatus"
		box.add_child(status)
		var row = UI.hbox(16)
		var cl = UI.button("취소", func(): close.call(null), "Ghost")
		var go = UI.button("가져오기", func():
			if te.text.strip_edges() == "":
				status.text = "붙여 넣은 글자가 없어요."
				return
			var r = Game.import_text(te.text)
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
