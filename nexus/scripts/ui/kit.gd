class_name UI
extends RefCounted
## 화면 조각 도우미 + 테마 만들기. 단위는 720×1280 기준 화면 좌표 (휴대폰 1dp ≈ 2).

const FONT_REGULAR := "res://assets/fonts/paperlogy/Paperlogy-4Regular.woff2"
const FONT_MEDIUM := "res://assets/fonts/paperlogy/Paperlogy-5Medium.woff2"
const FONT_SEMI := "res://assets/fonts/paperlogy/Paperlogy-6SemiBold.woff2"
const FONT_BOLD := "res://assets/fonts/paperlogy/Paperlogy-7Bold.woff2"

const TOUCH := 88        # 최소 터치 높이 (44dp)
const GAP := 20
const PAD := 32          # 화면 가장자리 여백
const RADIUS := 32

## 글자 크기
const XS := 22
const S := 25
const M := 29
const L := 36
const XL := 46
const XXL := 76

static var _fonts := {}


static func font(path: String) -> Font:
	if not _fonts.has(path):
		_fonts[path] = load(path)
	return _fonts[path]


static func _box(bg: Color, radius := RADIUS, border := Color.TRANSPARENT, bw := 0, shadow := false) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	if bw > 0:
		sb.border_color = border
		sb.set_border_width_all(bw)
	if shadow:
		sb.shadow_color = Palette.c.shadow
		sb.shadow_size = 18
		sb.shadow_offset = Vector2(0, 8)
	sb.anti_aliasing = true
	return sb


## 지금 색으로 테마를 만들어요 (화면 모드를 바꾸면 다시 불러요)
static func build_theme() -> Theme:
	var c := Palette.c
	var t := Theme.new()
	t.default_font = font(FONT_MEDIUM)
	t.default_font_size = M
	t.set_color("font_color", "Label", c.text)

	for v in ["Title", "Display", "Strong"]:
		t.set_type_variation(v, "Label")
	t.set_font("font", "Title", font(FONT_BOLD))
	t.set_font_size("font_size", "Title", L)
	t.set_font("font", "Display", font(FONT_BOLD))
	t.set_font_size("font_size", "Display", XXL)
	t.set_font("font", "Strong", font(FONT_SEMI))

	# 카드
	t.set_type_variation("Card", "PanelContainer")
	var card := _box(c.card, RADIUS, c.line, 2)
	card.set_content_margin_all(30)
	t.set_stylebox("panel", "Card", card)
	t.set_type_variation("CardSoft", "PanelContainer")
	var soft := _box(c.card2, 24)
	soft.set_content_margin_all(24)
	t.set_stylebox("panel", "CardSoft", soft)
	t.set_type_variation("Floating", "PanelContainer")
	var fl := _box(c.card, 40, c.line, 2, true)
	fl.set_content_margin_all(10)
	t.set_stylebox("panel", "Floating", fl)
	t.set_type_variation("Sheet", "PanelContainer")
	var sh := _box(c.card, 44, c.line, 2, true)
	sh.set_content_margin_all(36)
	t.set_stylebox("panel", "Sheet", sh)

	# 버튼 (기본 = 강조색)
	var states := {"normal": 1.0, "hover": 1.08, "pressed": 0.9, "focus": 1.0}
	for st in states:
		var b := _box(c.accent.lightened(states[st] - 1.0) if states[st] > 1 else c.accent.darkened(1.0 - states[st]), 24)
		b.set_content_margin_all(18)
		b.content_margin_left = 32
		b.content_margin_right = 32
		if st == "focus":
			b.bg_color = Color.TRANSPARENT
			b.draw_center = false
			b.border_color = c.text
			b.set_border_width_all(3)
		t.set_stylebox(st, "Button", b)
	var dis := _box(c.card2, 24)
	dis.set_content_margin_all(18)
	t.set_stylebox("disabled", "Button", dis)
	t.set_color("font_color", "Button", c.accent_ink)
	t.set_color("font_hover_color", "Button", c.accent_ink)
	t.set_color("font_pressed_color", "Button", c.accent_ink)
	t.set_color("font_focus_color", "Button", c.accent_ink)
	t.set_color("font_disabled_color", "Button", c.faint)
	t.set_font("font", "Button", font(FONT_SEMI))

	# 조용한 버튼
	t.set_type_variation("Ghost", "Button")
	for st in ["normal", "hover", "pressed"]:
		var g := _box(c.card2 if st == "normal" else c.card_hi, 24)
		g.set_content_margin_all(18)
		g.content_margin_left = 28
		g.content_margin_right = 28
		t.set_stylebox(st, "Ghost", g)
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		t.set_color(k, "Ghost", c.text)

	# 투명 버튼 (목록 줄·메뉴)
	t.set_type_variation("Flat", "Button")
	for st in ["normal", "hover", "pressed", "focus"]:
		var f: StyleBox = StyleBoxEmpty.new() if st != "pressed" else _box(c.card_hi, 24)
		t.set_stylebox(st, "Flat", f)
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		t.set_color(k, "Flat", c.text)

	# 위험 버튼
	t.set_type_variation("Danger", "Button")
	for st in ["normal", "hover", "pressed"]:
		var d := _box(c.danger if st != "pressed" else c.danger.darkened(0.15), 24)
		d.set_content_margin_all(18)
		t.set_stylebox(st, "Danger", d)
	for k in ["font_color", "font_hover_color", "font_pressed_color"]:
		t.set_color(k, "Danger", Color.WHITE)

	# 글 입력
	var te := _box(c.bg2, 20, c.line, 2)
	te.set_content_margin_all(20)
	t.set_stylebox("normal", "TextEdit", te)
	var tf: StyleBoxFlat = te.duplicate()
	tf.border_color = c.accent
	t.set_stylebox("focus", "TextEdit", tf)
	t.set_color("font_color", "TextEdit", c.text)
	t.set_color("font_placeholder_color", "TextEdit", c.faint)
	t.set_font_size("font_size", "TextEdit", XS)

	# 스크롤 막대: 얇게
	var grab := _box(Color(c.muted, 0.35), 4)
	t.set_stylebox("grabber", "VScrollBar", grab)
	t.set_stylebox("grabber_highlight", "VScrollBar", grab)
	t.set_stylebox("grabber_pressed", "VScrollBar", grab)
	t.set_stylebox("scroll", "VScrollBar", StyleBoxEmpty.new())
	return t


# ── 조각 ──
## 글자. wrap=true 면 줄바꿈하며 가로로 남은 폭을 채워요 (가로 줄 안에서 세로로 찌그러지지 않게).
## 짧은 표시(숫자·이름표)는 wrap=false.
static func label(text: String, size := M, color = null, variation := "", wrap := true) -> Label:
	var l := Label.new()
	l.text = text
	if variation != "":
		l.theme_type_variation = variation
	l.add_theme_font_size_override("font_size", size)
	if color != null:
		l.add_theme_color_override("font_color", color)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


static func title(text: String, size := L, wrap := true) -> Label:
	return label(text, size, null, "Title", wrap)


static func vbox(gap := GAP, children: Array = []) -> VBoxContainer:
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", gap)
	for ch in children:
		if ch != null:
			b.add_child(ch)
	return b


static func hbox(gap := GAP, children: Array = []) -> HBoxContainer:
	var b := HBoxContainer.new()
	b.add_theme_constant_override("separation", gap)
	for ch in children:
		if ch != null:
			b.add_child(ch)
	return b


static func card(children: Array, variation := "Card", gap := 16) -> PanelContainer:
	var p := PanelContainer.new()
	p.theme_type_variation = variation
	p.add_child(vbox(gap, children))
	return p


static func spacer(h := 0, w := 0) -> Control:
	var s := Control.new()
	s.custom_minimum_size = Vector2(w, h)
	if w == 0 and h == 0:
		s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return s


static func button(text: String, on_press: Callable, variation := "", testid := "") -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(TOUCH, TOUCH)
	if variation != "":
		b.theme_type_variation = variation
	b.add_theme_font_size_override("font_size", M)
	b.pressed.connect(on_press)
	if testid != "":
		b.name = testid
	b.focus_mode = Control.FOCUS_ALL
	return b


## 작은 표시 (속성·상태·임시 표시)
static func chip(text: String, color: Color, filled := false) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := _box(Color(color, 0.18) if not filled else color, 14)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	p.add_theme_stylebox_override("panel", sb)
	var l := label(text, XS, color if not filled else Palette.c.accent_ink, "Strong", false)
	p.add_child(l)
	return p


## 미확정 콘텐츠 표시
static func placeholder_chip() -> PanelContainer:
	return chip("임시", Palette.c.warn)


## 진행 막대
static func bar(value: float, color: Color, height := 14) -> Control:
	var b := BarView.new()
	b.value = value
	b.color = color
	b.custom_minimum_size = Vector2(0, height)
	return b


## 빈 상태 안내 (버튼 없이 글만)
static func empty_note(text: String) -> Label:
	var l := label(text, S, Palette.c.muted)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size = Vector2(0, 60)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


## 섹션 머리 (제목 + 오른쪽 작은 글)
static func section_head(text: String, aside := "") -> HBoxContainer:
	var h := hbox(12, [title(text, L)])
	h.get_child(0).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if aside != "":
		var a := label(aside, XS, Palette.c.muted, "", false)
		a.size_flags_vertical = Control.SIZE_SHRINK_END
		h.add_child(a)
	return h


## 시각 표시 (몇 분 전)
static func ago(t: int) -> String:
	var d := int(Time.get_unix_time_from_system()) - t
	if d < 60:
		return "방금"
	if d < 3600:
		return "%d분 전" % (d / 60)
	if d < 86400:
		return "%d시간 전" % (d / 3600)
	return "%d일 전" % (d / 86400)
