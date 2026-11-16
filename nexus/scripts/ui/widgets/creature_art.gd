class_name CreatureArt
extends Control
## 개체 그림. species.art 에 최종 그림(res:// 경로)이 있으면 그걸, 없으면 임시 그림을 코드로 그려요.
## 임시 그림: 종 id 로 모양이 정해지는 몸통 + 속성 색 + 눈. 상태에 따라
##   unknown(모름) = 검은 실루엣과 ? · seen(목격) = 흐린 색 · owned(확보) = 선명한 색

var species_id := ""
var state := "owned"            # unknown | seen | owned
var show_tag := false           # 왼쪽 위 ‘임시’ 표시
var _tex: Texture2D = null


static func make(sid: String, st: String, px := 160, tag := false) -> CreatureArt:
	var a := CreatureArt.new()
	a.species_id = sid
	a.state = st
	a.show_tag = tag
	a.custom_minimum_size = Vector2(px, px)
	a.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return a


func _ready() -> void:
	var path: String = Data.get_item("species", species_id).get("art", "")
	if path != "" and ResourceLoader.exists(path):
		_tex = load(path)
	resized.connect(queue_redraw)


func is_placeholder() -> bool:
	return _tex == null


func _draw() -> void:
	var sp := Data.get_item("species", species_id)
	var s := minf(size.x, size.y)
	var c := size / 2.0
	var el := Color(Data.get_item("elements", sp.get("element", "")).get("color", "#888888"))
	# 바탕 원
	var bg := Color(el, 0.14) if state != "unknown" else Color(Palette.c.text, 0.05)
	draw_circle(c, s * 0.48, bg, true, -1.0, true)
	if _tex != null and state != "unknown":
		var r := Rect2(c - Vector2(s, s) * 0.45, Vector2(s, s) * 0.9)
		draw_texture_rect(_tex, r, false, Color(1, 1, 1, 1.0 if state == "owned" else 0.45))
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(species_id)
	var stage := int(sp.get("evolution", {}).get("stage", 1))
	var body := el if state == "owned" else (el.darkened(0.45) if state == "seen" else Color(Palette.c.text, 0.12))
	# 몸통: 둥근 다각형 (점 개수·울퉁불퉁함이 종마다 다름)
	var n := 9 + rng.randi_range(0, 5)
	var base_r := s * (0.25 + 0.04 * stage)
	var pts := PackedVector2Array()
	var wob: Array[float] = []
	for i in n:
		wob.append(rng.randf_range(0.78, 1.18))
	for i in 64:
		var t := float(i) / 64.0
		var f := t * n
		var k: float = wob[int(f) % n] * (1.0 - (f - floor(f))) + wob[(int(f) + 1) % n] * (f - floor(f))
		var ang := t * TAU
		pts.append(c + Vector2(cos(ang), sin(ang) * 0.9) * base_r * k + Vector2(0, s * 0.03))
	# 귀·뿔 (단계가 높을수록 많게)
	for j in stage + rng.randi_range(0, 1):
		var ang := -PI / 2 + rng.randf_range(-0.9, 0.9)
		var tip := c + Vector2(cos(ang), sin(ang)) * base_r * rng.randf_range(1.35, 1.6)
		var w := rng.randf_range(0.18, 0.3)
		draw_colored_polygon(PackedVector2Array([c + Vector2(cos(ang - w), sin(ang - w)) * base_r * 0.9, tip, c + Vector2(cos(ang + w), sin(ang + w)) * base_r * 0.9]), body.darkened(0.12))
	draw_colored_polygon(pts, body)
	# 배 무늬
	if state != "unknown":
		draw_circle(c + Vector2(0, base_r * 0.3), base_r * 0.45, Color(1, 1, 1, 0.12 if state == "owned" else 0.05), true, -1.0, true)
	# 눈
	if state != "unknown":
		var eye_y := c.y - base_r * 0.15
		var gap := base_r * rng.randf_range(0.28, 0.4)
		var er := s * 0.035
		for sx in [-1, 1]:
			var p := Vector2(c.x + sx * gap, eye_y)
			draw_circle(p, er * 1.6, Color(1, 1, 1, 0.95 if state == "owned" else 0.4), true, -1.0, true)
			draw_circle(p + Vector2(0, er * 0.3), er * 0.8, Color(0.05, 0.07, 0.12), true, -1.0, true)
	else:
		var font := UI.font(UI.FONT_BOLD)
		var fs := int(s * 0.32)
		var w := font.get_string_size("?", HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(font, c + Vector2(-w / 2.0, fs * 0.36), "?", HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(Palette.c.text, 0.35))
	if show_tag and state != "unknown":
		var font2 := UI.font(UI.FONT_SEMI)
		draw_string(font2, Vector2(s * 0.06, s * 0.14), "임시 그림", HORIZONTAL_ALIGNMENT_LEFT, -1, maxi(14, int(s * 0.07)), Color(Palette.c.warn, 0.9))
