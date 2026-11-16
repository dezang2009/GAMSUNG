extends SceneTree
## 화면 캡처 (시각 확인용): xvfb-run godot --path . --resolution 720x1280 --script res://tools/capture.gd -- <출력 폴더>

var out := "user://shots"


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	_run.call_deferred()


func _shot(name: String) -> void:
	for i in 4:
		await process_frame
	root.get_texture().get_image().save_png(out.path_join(name + ".png"))
	print("saved ", name)


func _run() -> void:
	await process_frame
	var save = root.get_node("Save")
	var game = root.get_node("Game")
	save.dir = "user://capture_saves"
	DirAccess.make_dir_recursive_absolute(save.dir)
	for f in DirAccess.get_files_at(save.dir):
		DirAccess.remove_absolute(save.dir.path_join(f))
	game.settings.theme = "dark"
	var main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await _shot("0-title")
	game.new_game()
	game.state.planets.planet_01.cleared.region_01 = true
	game.state.resources.res_a = 120
	game.state.resources.res_b = 35
	game.state.resources.res_c = 4
	game.add_log("explore", "지역 1 개척을 마쳤어요 (캡처용 예시 진행)")
	main.render()
	await _shot("1-base")
	for id in ["planet", "explore", "creatures", "research"]:
		main.go(id)
		await _shot("2-" + id)
	main.go("planet")
	main.push("region", {"id": "region_04"}, "지역 4")
	await _shot("3-region")
	main.push("settings", {}, "설정")
	await _shot("4-settings")
	main.confirm("처음부터 다시 할까요?", "모든 탐사 기록이 지워져요. 되돌릴 수 없어요.", "모두 지우기", func(): pass)
	await _shot("5-sheet")
	main.close_sheet(null)
	game.set_theme("light")
	main.go("base")
	await _shot("6-light-base")
	main.go("planet")
	await _shot("7-light-planet")
	game.settings.theme = "dark"
	quit()
