class_name BarView
extends Control
## 둥근 진행 막대

var value := 0.0:
	set(v):
		value = clampf(v, 0.0, 1.0)
		queue_redraw()
var color := Color.WHITE


func _draw() -> void:
	var r := size.y / 2.0
	_round(Rect2(Vector2.ZERO, size), r, Palette.c.card2)
	if value > 0.0:
		_round(Rect2(Vector2.ZERO, Vector2(maxf(size.y, size.x * value), size.y)), r, color)


func _round(rect: Rect2, r: float, col: Color) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(int(r))
	sb.anti_aliasing = true
	draw_style_box(sb, rect)
