extends SceneTree
## 입력 이벤트 흐름 확인용
class Spy:
	extends Node
	func _input(e: InputEvent) -> void:
		if e is InputEventMouseButton or e is InputEventScreenTouch:
			print("  input: ", e.get_class(), " pressed=", e.pressed, " pos=", e.position)


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(720, 1280)
	var spy := Spy.new()
	root.add_child(spy)
	var b := Button.new()
	b.size = Vector2(300, 200)
	b.pressed.connect(func(): print("  >> 버튼 pressed"))
	root.add_child(b)
	await process_frame
	print("터치 한 번:")
	var e := InputEventScreenTouch.new()
	e.position = Vector2(100, 100)
	e.pressed = true
	Input.parse_input_event(e)
	var e2: InputEventScreenTouch = e.duplicate()
	e2.pressed = false
	Input.parse_input_event(e2)
	await process_frame
	await process_frame
	print("마우스 누름·뗌 직접 보내기:")
	var m := InputEventMouseButton.new()
	m.button_index = MOUSE_BUTTON_LEFT
	m.position = Vector2(100, 100)
	m.pressed = true
	Input.parse_input_event(m)
	var m2: InputEventMouseButton = m.duplicate()
	m2.pressed = false
	Input.parse_input_event(m2)
	await process_frame
	await process_frame
	quit()
