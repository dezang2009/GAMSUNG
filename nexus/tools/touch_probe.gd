extends SceneTree
## 터치 동작 측정: 스크롤 안의 버튼을 손가락으로 누르기·살짝 흔들며 누르기·끌어서 스크롤
## godot --headless --path . --script res://tools/touch_probe.gd [-- kinetic]

var presses := 0
var sc: ScrollContainer


func _initialize() -> void:
	_run.call_deferred()


func _touch(pos: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = 0
	e.position = pos
	e.pressed = pressed
	Input.parse_input_event(e)


func _drag(pos: Vector2, rel: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = 0
	e.position = pos
	e.relative = rel
	e.screen_relative = rel
	e.velocity = rel * 60.0
	Input.parse_input_event(e)


func _frames(n := 3) -> void:
	for i in n:
		await process_frame


func _gesture(name: String, moves: Array) -> void:
	var start_scroll := sc.scroll_vertical
	var before := presses
	var p := Vector2(200, 300)
	_touch(p, true)
	await _frames()
	for m in moves:
		p += m
		_drag(p, m)
		await _frames(1)
	_touch(p, false)
	await _frames()
	print("%s: 버튼 눌림 %d · 스크롤 %d → %d" % [name, presses - before, start_scroll, sc.scroll_vertical])


func _run() -> void:
	root.size = Vector2i(720, 1280)
	var kinetic := "kinetic" in OS.get_cmdline_user_args()
	for dz in [0, 24]:
		if kinetic:
			sc = load("res://scripts/ui/widgets/touch_scroll.gd").new()
		else:
			sc = ScrollContainer.new()
		sc.size = Vector2(720, 1280)
		sc.scroll_deadzone = dz
		var v := VBoxContainer.new()
		v.custom_minimum_size = Vector2(700, 0)
		sc.add_child(v)
		for i in 30:
			var b := Button.new()
			b.text = "버튼 %d" % i
			b.custom_minimum_size = Vector2(700, 120)
			b.pressed.connect(func(): presses += 1)
			v.add_child(b)
		root.add_child(sc)
		await _frames()
		print("— %s scroll_deadzone = %d" % ["관성 스크롤" if kinetic else "기본 ScrollContainer", dz])
		await _gesture("가볍게 탭", [])
		await _gesture("손가락이 6px 흔들린 탭", [Vector2(0, -3), Vector2(0, -3)])
		var drag := []
		for i in 10:
			drag.append(Vector2(0, -30))
		await _gesture("위로 300px 끌기", drag)
		var after_release := sc.scroll_vertical
		await _frames(30)
		print("  손 뗀 뒤 0.5초: 스크롤 %d → %d (관성)" % [after_release, sc.scroll_vertical])
		sc.queue_free()
		await _frames()
	quit()
