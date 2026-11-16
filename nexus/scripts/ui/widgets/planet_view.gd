class_name PlanetView
extends Control
## 행성 그림 (임시 · 코드로 그림). 지역 표시: 잠김(흐린 고리) · 열림(강조색 고리) · 개척 완료(채운 점)
## 최종 일러스트가 정해지면 planets.json 에 그림 경로를 더해 바꿔 끼울 수 있게 Phase 5 에서 확장해요.

signal region_pressed(region_id: String)

var planet: Dictionary = {}
var regions: Array = []
var states: Dictionary = {}     # 지역 id → "locked" | "open" | "cleared"
var show_labels := true


func _ready() -> void:
	resized.connect(queue_redraw)


func setup(p: Dictionary, r: Array, s: Dictionary) -> void:
	planet = p
	regions = r
	states = s
	queue_redraw()


func _geom() -> Array:
	var d := minf(size.x, size.y) * 0.86
	var center := size / 2.0
	return [center, d / 2.0]


func region_pos(reg: Dictionary) -> Vector2:
	var g := _geom()
	var c: Vector2 = g[0]
	var r: float = g[1]
	return c + (Vector2(reg.map[0], reg.map[1]) - Vector2(0.5, 0.5)) * 2.0 * r * 0.82


func _draw() -> void:
	if planet.is_empty():
		return
	var g := _geom()
	var c: Vector2 = g[0]
	var r: float = g[1]
	var pal: Array = planet.get("palette", ["#2b3a55", "#3f6f8f", "#c9a66b"])
	var base := Color(pal[0])
	var mid := Color(pal[1])
	var land := Color(pal[2])
	# 대기 빛
	for i in 10:
		draw_circle(c, r + 4 + i * 3, Color(mid, 0.035), true, -1.0, true)
	# 몸통 (안쪽으로 밝아지는 층)
	for i in 14:
		var t := i / 13.0
		draw_circle(c + Vector2(-r * 0.18, -r * 0.2) * t, r * (1.0 - t * 0.62), base.lerp(mid, t * 0.85), true, -1.0, true)
	# 땅 조각 (씨앗 고정)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(planet.get("id", ""))
	for i in 9:
		var ang := rng.randf() * TAU
		var dist := rng.randf_range(0.1, 0.68) * r
		var pr := rng.randf_range(0.08, 0.2) * r
		draw_circle(c + Vector2(cos(ang), sin(ang)) * dist, pr, Color(land, 0.22), true, -1.0, true)
	# 그림자 (오른쪽 아래)
	for i in 8:
		draw_arc(c + Vector2(r * 0.06, r * 0.06), r - i * 2.5, -0.15 * PI, 0.85 * PI, 64, Color(0, 0, 0, 0.06), 6.0, true)
	draw_arc(c, r, 0, TAU, 96, Color(Palette.c.text, 0.1), 2.0, true)
	# 지역 표시
	var font := UI.font(UI.FONT_SEMI)
	for reg in regions:
		var p := region_pos(reg)
		var st: String = states.get(reg.id, "locked")
		match st:
			"cleared":
				draw_circle(p, 16, Palette.c.teal, true, -1.0, true)
				draw_arc(p, 24, 0, TAU, 40, Color(Palette.c.teal, 0.5), 3.0, true)
			"open":
				draw_circle(p, 10, Palette.c.accent, true, -1.0, true)
				draw_arc(p, 22, 0, TAU, 40, Palette.c.accent, 4.0, true)
			_:
				draw_arc(p, 14, 0, TAU, 40, Color(Palette.c.text, 0.35), 3.0, true)
		if show_labels:
			var txt: String = reg.name
			var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.XS).x
			var lp := p + Vector2(-w / 2.0, 52)
			draw_string(font, lp + Vector2(0, 2), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.XS, Color(0, 0, 0, 0.55))
			draw_string(font, lp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.XS, Color(Palette.c.text, 0.95 if st != "locked" else 0.6))


func _gui_input(event: InputEvent) -> void:
	var pos := Vector2.INF
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
	if pos == Vector2.INF:
		return
	# 손가락으로 누르기 쉽게 넉넉한 범위(64)에서 가장 가까운 지역
	var best := ""
	var best_d := 64.0
	for reg in regions:
		var d := region_pos(reg).distance_to(pos)
		if d <= best_d:
			best_d = d
			best = reg.id
	if best != "":
		region_pressed.emit(best)
		accept_event()
