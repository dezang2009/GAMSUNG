class_name IconView
extends Control
## 직접 그린 선 아이콘 (24 칸 기준 좌표를 크기에 맞춰 늘려요). 글자·이모지 아이콘은 쓰지 않아요.

var icon := "":
	set(v):
		icon = v
		queue_redraw()
var color := Color.WHITE:
	set(v):
		color = v
		queue_redraw()
var stroke := 2.0


static func make(name: String, px := 48, col := Color.WHITE) -> IconView:
	var i := IconView.new()
	i.icon = name
	i.color = col
	i.custom_minimum_size = Vector2(px, px)
	i.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return i


func _p(x: float, y: float) -> Vector2:
	var k := minf(size.x, size.y) / 24.0
	var off := (size - Vector2(24, 24) * k) / 2.0
	return off + Vector2(x, y) * k


func _line(pts: Array) -> void:
	var arr := PackedVector2Array()
	for q in pts:
		arr.append(_p(q[0], q[1]))
	draw_polyline(arr, color, stroke * minf(size.x, size.y) / 24.0, true)


func _circle(cx: float, cy: float, r: float, filled := false) -> void:
	var k := minf(size.x, size.y) / 24.0
	if filled:
		draw_circle(_p(cx, cy), r * k, color, true, -1.0, true)
	else:
		draw_arc(_p(cx, cy), r * k, 0, TAU, 48, color, stroke * k, true)


func _draw() -> void:
	match icon:
		"base": # 기지: 육각 돔
			_line([[4, 19], [4, 11], [12, 5], [20, 11], [20, 19], [4, 19]])
			_line([[9, 19], [9, 14], [15, 14], [15, 19]])
		"planet": # 행성: 원 + 고리
			_circle(12, 12, 6)
			_line([[2.5, 15.5], [7, 13.6]])
			_line([[17, 10.4], [21.5, 8.5]])
		"explore": # 탐사: 나침반
			_circle(12, 12, 9)
			_line([[15.5, 8.5], [13.4, 13.4], [8.5, 15.5], [10.6, 10.6], [15.5, 8.5]])
		"creatures": # 개체: 알
			_line([[12, 3.5], [16.2, 8], [17.5, 13.5], [15.8, 18.6], [12, 20.5], [8.2, 18.6], [6.5, 13.5], [7.8, 8], [12, 3.5]])
			_line([[9, 13], [11, 15], [15, 11]])
		"research": # 연구: 플라스크
			_line([[9.5, 3.5], [9.5, 9.5], [4.5, 18.5], [5.5, 20.5], [18.5, 20.5], [19.5, 18.5], [14.5, 9.5], [14.5, 3.5]])
			_line([[8, 3.5], [16, 3.5]])
			_line([[7, 15], [17, 15]])
		"settings":
			_circle(12, 12, 3)
			for a in 8:
				var ang := a * TAU / 8.0
				_line([[12 + cos(ang) * 6.5, 12 + sin(ang) * 6.5], [12 + cos(ang) * 9, 12 + sin(ang) * 9]])
		"back":
			_line([[15, 5], [8, 12], [15, 19]])
		"chevron":
			_line([[9, 5], [16, 12], [9, 19]])
		"lock":
			_line([[6, 11], [18, 11], [18, 20], [6, 20], [6, 11]])
			_line([[8.5, 11], [8.5, 8], [12, 4.5], [15.5, 8], [15.5, 11]])
		"check":
			_line([[5, 12.5], [10, 17.5], [19, 7]])
		"close":
			_line([[6, 6], [18, 18]])
			_line([[18, 6], [6, 18]])
