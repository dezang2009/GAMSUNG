class_name TouchScroll
extends ScrollContainer
## 손가락 스크롤 (휴대폰 감각에 맞춤)
##  - 어디서 끌기 시작해도(카드·버튼 위 포함) 스크롤돼요.
##  - TAP_SLOP 보다 적게 움직이고 떼면 ‘탭’: 그 자리에 누름·뗌을 다시 보내 버튼·카드가 눌려요.
##  - 더 많이 움직이면 ‘스크롤’: 버튼은 눌리지 않고, 손을 떼면 관성으로 미끄러지다 멈춰요.
##  - 마우스 휠은 그대로 둬요. enabled=false 면(시트가 열렸을 때 등) 아무것도 가로채지 않아요.
## 휴대폰 터치는 마우스 이벤트로도 들어오므로(emulate_mouse_from_touch) 마우스 이벤트만 다뤄요.

const TAP_SLOP := 20.0       # 탭으로 보는 최대 움직임 (화면 좌표, 약 10dp)
const FRICTION := 0.04       # 1초 뒤 남는 속도 비율 (작을수록 빨리 멈춤)
const MIN_FLING := 60.0      # 이보다 느리면 관성 없음 (px/초)
const MAX_FLING := 6000.0

var enabled := true
var _tracking := false
var _dragging := false
var _start := Vector2.ZERO
var _last := Vector2.ZERO
var _last_t := 0
var _vel := 0.0
var _fling := 0.0
var _fling_pos := 0.0
var _press: InputEventMouseButton = null
var _replays := 0


func _input(event: InputEvent) -> void:
	# 다시 보낸 탭(누름·뗌)은 통과 (마우스 → 터치 흉내가 켜져 있으면 터치 이벤트도 함께 생겨요)
	if _replays > 0 and (event is InputEventMouseButton or event is InputEventScreenTouch):
		_replays -= 1
		return
	if not enabled or not is_visible_in_tree():
		_tracking = false
		return
	# 손가락 이벤트 자체(터치·끌기)는 누르고 있는 동안 모두 막아요. 판단은 마우스 이벤트로만.
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		if _tracking or (event is InputEventScreenTouch and event.pressed and get_global_rect().has_point(event.position)):
			get_viewport().set_input_as_handled()
		elif event is InputEventScreenTouch and not event.pressed and _dragging:
			get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if not get_global_rect().has_point(event.position):
				return
			_tracking = true
			_dragging = false
			_fling = 0.0
			_start = event.position
			_last = event.position
			_last_t = Time.get_ticks_msec()
			_vel = 0.0
			_press = event.duplicate()
			get_viewport().set_input_as_handled()
		elif _tracking:
			_tracking = false
			get_viewport().set_input_as_handled()
			if _dragging:
				if absf(_vel) >= MIN_FLING and Time.get_ticks_msec() - _last_t < 120:
					_fling = clampf(_vel, -MAX_FLING, MAX_FLING)
					_fling_pos = float(scroll_vertical)
			else:
				_replay(event)
	elif event is InputEventMouseMotion and _tracking:
		get_viewport().set_input_as_handled()
		var now := Time.get_ticks_msec()
		var d: Vector2 = event.position - _last
		if not _dragging and absf(event.position.y - _start.y) > TAP_SLOP:
			_dragging = true
			d = event.position - _start  # 문턱을 넘는 순간 그동안 움직인 만큼 따라가요
			d.y -= signf(d.y) * TAP_SLOP
		if _dragging:
			scroll_vertical -= int(round(d.y))
			var dt := maxf(1.0, float(now - _last_t)) / 1000.0
			_vel = lerpf(_vel, -d.y / dt, 0.5)
		_last = event.position
		_last_t = now


## 탭: 처음 누른 자리에 누름 → 뗌 을 다시 보내요 (이번엔 가로채지 않음)
func _replay(release: InputEventMouseButton) -> void:
	if _press == null:
		return
	var up: InputEventMouseButton = release.duplicate()
	up.position = _press.position
	up.global_position = _press.global_position
	_replays = 4 if ProjectSettings.get_setting("input_devices/pointing/emulate_touch_from_mouse", false) else 2
	Input.parse_input_event(_press)
	Input.parse_input_event(up)


func _process(delta: float) -> void:
	if _fling == 0.0 or _tracking:
		return
	_fling_pos += _fling * delta
	var before := scroll_vertical
	scroll_vertical = int(round(_fling_pos))
	_fling *= pow(FRICTION, delta)
	if absf(_fling) < MIN_FLING or scroll_vertical == before and absf(_fling * delta) >= 1.0:
		_fling = 0.0


func is_scrolling() -> bool:
	return _dragging or _fling != 0.0
