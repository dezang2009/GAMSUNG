class_name TapCard
extends PanelContainer
## 눌리는 카드: 내용 높이만큼 늘어나는 카드 + pressed 신호 (버튼 안에 카드를 넣어 높이가 고정되던 문제를 없앰)
## 누르는 동안 살짝 어두워져요. 키보드(엔터·스페이스)로도 눌러요.

signal pressed

var _down := false


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	custom_minimum_size = Vector2(UI.TOUCH, UI.TOUCH)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_down = true
			modulate = Color(0.86, 0.86, 0.9)
			accept_event()
		elif _down:
			_down = false
			modulate = Color.WHITE
			accept_event()
			if Rect2(Vector2.ZERO, size).has_point(event.position):
				pressed.emit()
	elif event.is_action_pressed("ui_accept"):
		pressed.emit()
		accept_event()


func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_EXIT and _down:
		_down = false
		modulate = Color.WHITE
