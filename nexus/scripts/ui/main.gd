extends Control
## 화면 틀: 배경 · (데이터 오류 | 첫 화면 | 게임) · 상단 자원 막대 · 내용 · 떠 있는 하단 메뉴 · 시트 · 알림
## 탭마다 화면 쌓기(stack)가 따로 있어요. 뒤로 가기: 시트 닫기 → 쌓인 화면 빼기 → 기지 탭 → 앱 종료

const TABS := [
	{"id": "base", "name": "기지", "icon": "base"},
	{"id": "planet", "name": "행성", "icon": "planet"},
	{"id": "explore", "name": "탐사", "icon": "explore", "center": true},
	{"id": "creatures", "name": "개체", "icon": "creatures"},
	{"id": "research", "name": "연구", "icon": "research"},
]

var tab := "base"
var ui := {}                # 화면 상태 (거르기·정렬 등, 저장 안 함)
var stacks := {}            # 탭 id → [{ screen, args, title }]
var _sheet: Control = null
var _sheet_cb: Callable
var _layer_content: Control
var _layer_over: Control
var _scroll: ScrollContainer
var _nav_buttons := {}
var _topbar: Control
var _safe_top := 0.0
var _safe_bottom := 0.0


func _ready() -> void:
	Palette.apply(Game.settings.theme)
	theme = UI.build_theme()
	get_tree().set_auto_accept_quit(false)
	Bus.state_changed.connect(_on_state_changed)
	Bus.settings_changed.connect(_on_settings_changed)
	Bus.saved.connect(_on_saved)
	_compute_safe_area()
	for t in TABS:
		stacks[t.id] = [{"screen": t.id, "args": {}, "title": t.name}]
	_rebuild()


func _compute_safe_area() -> void:
	# 휴대폰(상태 표시줄·제스처 막대)에서만 씀. 데스크톱·테스트 창에서는 0.
	if not OS.has_feature("mobile"):
		return
	var win := DisplayServer.window_get_size()
	var safe := DisplayServer.get_display_safe_area()
	if win.y <= 0 or safe.size.y <= 0:
		return
	var k := get_viewport_rect().size.y / float(win.y)
	_safe_top = clampf(safe.position.y * k, 0.0, 140.0)
	_safe_bottom = clampf((win.y - safe.end.y) * k, 0.0, 100.0)


# ── 크게 다시 그리기 ──
func _rebuild() -> void:
	for ch in get_children():
		remove_child(ch)
		ch.queue_free()
	_sheet = null
	add_child(_full(Starfield.new()))
	if not Data.errors.is_empty():
		add_child(_full(Screens.data_errors(self)))
		return
	if not Game.has_game():
		add_child(_full(Screens.title(self)))
		return
	_build_shell()


func _full(c: Control) -> Control:
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return c


func _build_shell() -> void:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)
	add_child(_full(col))
	_topbar = _build_topbar()
	col.add_child(_topbar)
	_scroll = ScrollContainer.new()
	_scroll.name = "Scroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(_scroll)
	_layer_content = MarginContainer.new()
	_layer_content.name = "Content"
	_layer_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for side in ["left", "right"]:
		_layer_content.add_theme_constant_override("margin_" + side, UI.PAD)
	_layer_content.add_theme_constant_override("margin_top", 8)
	_layer_content.add_theme_constant_override("margin_bottom", 230 + int(_safe_bottom))
	_scroll.add_child(_layer_content)
	add_child(_build_nav())
	_layer_over = Control.new()
	_layer_over.name = "Overlay"
	_layer_over.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_full(_layer_over))
	render()


func _build_topbar() -> Control:
	var m := MarginContainer.new()
	m.name = "TopBar"
	m.add_theme_constant_override("margin_left", UI.PAD)
	m.add_theme_constant_override("margin_right", UI.PAD - 8)
	m.add_theme_constant_override("margin_top", int(_safe_top) + 20)
	m.add_theme_constant_override("margin_bottom", 12)
	var row := UI.hbox(14)
	m.add_child(row)
	var logo := UI.label("NEXUS", UI.L, Palette.c.text, "Title", false)
	logo.add_theme_constant_override("outline_size", 0)
	row.add_child(logo)
	row.add_child(UI.spacer())
	# 자원 (설정 파일 순서대로, 지금 가진 양)
	var res_row := UI.hbox(10)
	res_row.name = "Resources"
	for r in Data.all("resources"):
		var chip := UI.hbox(8)
		var dot := ColorRect.new()
		dot.custom_minimum_size = Vector2(14, 14)
		dot.color = Color(r.color)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		chip.add_child(dot)
		var amount := UI.label(str(Game.state.resources.get(r.id, 0)), UI.S, Palette.c.text, "Strong", false)
		amount.tooltip_text = r.name
		chip.add_child(amount)
		res_row.add_child(chip)
	var res_panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Palette.c.card
	sb.border_color = Palette.c.line
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(40)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	res_panel.add_theme_stylebox_override("panel", sb)
	res_panel.add_child(res_row)
	res_panel.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(res_panel)
	var gear := Button.new()
	gear.name = "SettingsButton"
	gear.theme_type_variation = "Flat"
	gear.custom_minimum_size = Vector2(UI.TOUCH, UI.TOUCH)
	gear.tooltip_text = "설정"
	gear.add_child(_centered(IconView.make("settings", 44, Palette.c.muted)))
	gear.pressed.connect(func(): push("settings", {}, "설정"))
	row.add_child(gear)
	return m


func _centered(c: Control) -> Control:
	var cc := CenterContainer.new()
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cc.add_child(c)
	return cc


func _build_nav() -> Control:
	# 떠 있는 하단 메뉴. 가운데 ‘탐사’는 크고 강조색.
	var holder := Control.new()
	holder.name = "Nav"
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	holder.offset_top = -(150 + _safe_bottom)
	holder.offset_bottom = 0
	var bar := PanelContainer.new()
	bar.theme_type_variation = "Floating"
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bar.offset_left = UI.PAD - 8
	bar.offset_right = -(UI.PAD - 8)
	bar.offset_top = -(126 + _safe_bottom)
	bar.offset_bottom = -(20 + _safe_bottom)
	holder.add_child(bar)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 0)
	bar.add_child(row)
	for t in TABS:
		var b := Button.new()
		b.name = "Nav_" + t.id
		b.theme_type_variation = "Flat"
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(UI.TOUCH, 92)
		b.focus_mode = Control.FOCUS_ALL
		var v := UI.vbox(2)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		if t.get("center", false):
			# 가운데 원형 버튼: 막대 위로 솟아 있고 아래에 이름
			var circle := PanelContainer.new()
			circle.name = "CenterCircle"
			circle.mouse_filter = Control.MOUSE_FILTER_IGNORE
			var sb := StyleBoxFlat.new()
			sb.bg_color = Palette.c.accent
			sb.set_corner_radius_all(54)
			sb.shadow_color = Color(Palette.c.accent, 0.35)
			sb.shadow_size = 16
			sb.shadow_offset = Vector2(0, 6)
			sb.anti_aliasing = true
			circle.add_theme_stylebox_override("panel", sb)
			var icc0 := CenterContainer.new()
			icc0.mouse_filter = Control.MOUSE_FILTER_IGNORE
			icc0.add_child(IconView.make(t.icon, 54, Palette.c.accent_ink))
			circle.add_child(icc0)
			circle.set_anchors_preset(Control.PRESET_CENTER_TOP)
			circle.offset_left = -54
			circle.offset_right = 54
			circle.offset_top = -46
			circle.offset_bottom = 62
			b.add_child(circle)
			var l := UI.label(t.name, UI.XS, Palette.c.accent, "Strong", false)
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			l.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
			l.offset_top = -30
			l.offset_bottom = -2
			b.add_child(l)
		else:
			var icc := CenterContainer.new()
			icc.mouse_filter = Control.MOUSE_FILTER_IGNORE
			icc.add_child(IconView.make(t.icon, 44, Palette.c.faint))
			v.add_child(icc)
			var l := UI.label(t.name, UI.XS, Palette.c.faint, "Strong", false)
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			v.add_child(l)
		v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		b.add_child(v)
		b.pressed.connect(go.bind(t.id))
		row.add_child(b)
		_nav_buttons[t.id] = {"button": b, "box": v, "center": t.get("center", false)}
	return holder


func _paint_nav() -> void:
	for id in _nav_buttons:
		var nb: Dictionary = _nav_buttons[id]
		if nb.center:
			continue
		var on: bool = id == tab
		var col: Color = Palette.c.accent if on else Palette.c.faint
		var box: VBoxContainer = nb.box
		(box.get_child(0).get_child(0) as IconView).color = col
		(box.get_child(1) as Label).add_theme_color_override("font_color", col)


# ── 화면 이동 ──
func go(id: String) -> void:
	if id == tab and stacks[id].size() == 1:
		_scroll.scroll_vertical = 0
		return
	if id == tab:
		stacks[id] = [stacks[id][0]]
	tab = id
	render()


func push(screen: String, args := {}, title := "") -> void:
	stacks[tab].append({"screen": screen, "args": args, "title": title})
	render()


func back() -> bool:
	if _sheet != null:
		close_sheet(null)
		return true
	if stacks.has(tab) and stacks[tab].size() > 1:
		stacks[tab].pop_back()
		render()
		return true
	if Game.has_game() and tab != "base":
		go("base")
		return true
	return false


func depth() -> int:
	return stacks[tab].size()


func current_screen() -> String:
	return stacks[tab].back().screen


func render() -> void:
	if _layer_content == null or not is_instance_valid(_layer_content):
		return
	for ch in _layer_content.get_children():
		_layer_content.remove_child(ch)
		ch.queue_free()
	# 상단 자원 막대도 지금 값으로
	if _topbar != null and is_instance_valid(_topbar):
		var parent := _topbar.get_parent()
		var idx := _topbar.get_index()
		parent.remove_child(_topbar)
		_topbar.queue_free()
		_topbar = _build_topbar()
		parent.add_child(_topbar)
		parent.move_child(_topbar, idx)
	var top: Dictionary = stacks[tab].back()
	var page := UI.vbox(28)
	page.name = "Page_" + top.screen
	if stacks[tab].size() > 1:
		page.add_child(_sub_header(top.title))
	page.add_child(Screens.build(self, top.screen, top.args))
	_layer_content.add_child(page)
	_scroll.scroll_vertical = 0
	_paint_nav()


func _sub_header(text: String) -> Control:
	var row := UI.hbox(8)
	var b := Button.new()
	b.name = "BackButton"
	b.theme_type_variation = "Flat"
	b.custom_minimum_size = Vector2(UI.TOUCH, UI.TOUCH)
	b.tooltip_text = "뒤로"
	b.add_child(_centered(IconView.make("back", 44, Palette.c.text)))
	b.pressed.connect(back)
	row.add_child(b)
	var t := UI.title(text, UI.XL)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(t)
	return row


# ── 시트 (확인·글 입력) ──
## 아래에서 올라오는 창. build(내용 상자, close 함수) 로 채워요. 닫히면 cb(값)
func open_sheet(build: Callable, cb := Callable()) -> void:
	if _sheet != null:
		close_sheet(null)
	var layer := _layer_over if _layer_over != null and is_instance_valid(_layer_over) else self
	var dim := ColorRect.new()
	dim.name = "Sheet"
	dim.color = Color(0, 0, 0, 0.55)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: close_sheet(null))
	var panel := PanelContainer.new()
	panel.theme_type_variation = "Sheet"
	panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	panel.offset_left = 16
	panel.offset_right = -16
	panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	panel.offset_bottom = -(16 + _safe_bottom)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var box := UI.vbox(24)
	panel.add_child(box)
	dim.add_child(panel)
	layer.add_child(dim)
	_sheet = dim
	_sheet_cb = cb
	build.call(box, close_sheet)


func close_sheet(value) -> void:
	if _sheet == null:
		return
	_sheet.queue_free()
	_sheet = null
	var cb := _sheet_cb
	_sheet_cb = Callable()
	if cb.is_valid():
		cb.call(value)


func confirm(title: String, text: String, ok_text: String, on_ok: Callable, danger := true) -> void:
	open_sheet(func(box: VBoxContainer, close: Callable):
		box.add_child(UI.title(title, UI.XL))
		box.add_child(UI.label(text, UI.M, Palette.c.muted))
		var row := UI.hbox(16)
		var no := UI.button("취소", func(): close.call(false), "Ghost", "SheetCancel")
		no.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var yes := UI.button(ok_text, func(): close.call(true), "Danger" if danger else "", "SheetOk")
		yes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(no)
		row.add_child(yes)
		box.add_child(row), func(v): if v == true: on_ok.call())


# ── 알림 ──
func toast(text: String, warn := false) -> void:
	var p := PanelContainer.new()
	p.name = "Toast"
	var sb := StyleBoxFlat.new()
	sb.bg_color = Palette.c.danger if warn else Color("#1d2336")
	sb.set_corner_radius_all(24)
	sb.content_margin_left = 30
	sb.content_margin_right = 30
	sb.content_margin_top = 20
	sb.content_margin_bottom = 20
	p.add_theme_stylebox_override("panel", sb)
	var l := UI.label(text, UI.S, Color.WHITE)
	p.add_child(l)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	p.anchor_left = 0.0
	p.anchor_right = 1.0
	p.offset_left = 40
	p.offset_right = -40
	p.offset_top = -(300 + _safe_bottom)
	p.offset_bottom = -(200 + _safe_bottom)
	add_child(p)
	var tw := create_tween()
	tw.tween_interval(2.6)
	tw.tween_property(p, "modulate:a", 0.0, 0.3)
	tw.tween_callback(p.queue_free)


# ── 신호 ──
func _on_state_changed(reason: String) -> void:
	if reason in ["new_game", "load", "import", "reset"]:
		tab = "base"
		ui = {}
		for t in TABS:
			stacks[t.id] = [{"screen": t.id, "args": {}, "title": t.name}]
		_rebuild()
	else:
		render()


func _on_settings_changed() -> void:
	Palette.apply(Game.settings.theme)
	theme = UI.build_theme()
	var keep_tab := tab
	var keep := stacks.duplicate(true)
	_rebuild()
	tab = keep_tab
	stacks = keep
	render()


func _on_saved(ok: bool, message: String) -> void:
	if not ok:
		toast("저장하지 못했어요: %s" % message, true)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if not back():
			Game.save_now()
			get_tree().quit()
	elif what == NOTIFICATION_WM_CLOSE_REQUEST:
		Game.save_now()
		get_tree().quit()
