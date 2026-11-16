extends SceneTree
func _initialize() -> void:
	_run.call_deferred()
func _f(n := 3) -> void:
	for i in n:
		await process_frame
func _t(p: Vector2, d: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.position = p
	e.pressed = d
	Input.parse_input_event(e)
func _run() -> void:
	await process_frame
	var game = root.get_node("Game")
	game.new_game()
	var main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await _f()
	main.go("explore")
	await _f()
	var card = main.find_child("Region_region_01", true, false)
	var sc = main.find_child("Scroll", true, false)
	print("root size ", root.size, " visible rect ", root.get_visible_rect(), " scroll rect ", sc.get_global_rect(), " card ", card.get_global_rect())
	var p: Vector2 = card.get_global_rect().get_center()
	card.pressed.connect(func(): print("  >> card pressed"))
	_t(p, true)
	await _f(1)
	_t(p, false)
	await _f(3)
	print("depth after tap: ", main.depth())
	quit()
