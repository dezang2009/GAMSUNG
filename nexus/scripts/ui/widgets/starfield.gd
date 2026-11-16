class_name Starfield
extends Control
## 배경 별 (고정된 씨앗으로 항상 같은 배치). 어둡게 모드에서만 보여요.

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.c.bg)
	var top: Color = Palette.c.bg2
	for i in 24:
		var y := size.y * 0.45 * (1.0 - i / 24.0)
		draw_rect(Rect2(0, 0, size.x, y), Color(top, 0.04))
	if Palette.mode != "dark":
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 7021
	for i in 90:
		var p := Vector2(rng.randf() * size.x, rng.randf() * size.y)
		var r := rng.randf_range(0.8, 2.2)
		draw_circle(p, r, Color(Palette.c.star, rng.randf_range(0.15, 0.55)), true, -1.0, true)
