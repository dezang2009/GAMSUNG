extends SceneTree
## 테스트 실행기: godot --headless --script res://tests/run_tests.gd
## tests/test_*.gd 의 test_ 로 시작하는 함수를 차례로 불러요. 실패가 있으면 종료 코드 1.

var passed := 0
var failed: Array[String] = []
var _current := ""


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame # 자동 로드(Data·Save·Game) 준비
	var files := DirAccess.get_files_at("res://tests")
	files.sort()
	for f in files:
		if not (f.begins_with("test_") and f.ends_with(".gd")):
			continue
		var script = load("res://tests/" + f)
		if script == null or not script.can_instantiate():
			failed.append("%s: 불러오지 못했어요 (문법 오류)" % f)
			continue
		var suite = script.new()
		suite.set("t", self)
		print("\n■ ", f)
		for m in suite.get_method_list():
			var name: String = m.name
			if not name.begins_with("test_"):
				continue
			_current = "%s › %s" % [f.trim_suffix(".gd"), name]
			var before := failed.size()
			if suite.has_method("before_each"):
				await suite.before_each()
			await suite.call(name)
			if suite.has_method("after_each"):
				await suite.after_each()
			print("  %s %s" % ["✓" if failed.size() == before else "✗", name])
	print("\n%d 통과, %d 실패" % [passed, failed.size()])
	for f in failed:
		print("  ✗ ", f)
	quit(1 if failed.size() > 0 else 0)


# ── 확인 도우미 (테스트 파일에서 t.ok(...) 로 불러요) ──
func ok(cond: bool, what: String) -> void:
	if cond:
		passed += 1
	else:
		failed.append("%s: %s" % [_current, what])


func eq(a, b, what: String) -> void:
	ok(a == b, "%s (기대 %s, 실제 %s)" % [what, str(b), str(a)])
