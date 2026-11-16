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
	game.state.seed = 4242
	game.survey_region("region_01")
	game.survey_region("region_01")
	game.state.planets.planet_01.cleared.region_01 = true
	main.render()
	await _shot("1-base")
	main.go("creatures")
	await _shot("2-creatures")
	main.push("dex", {}, "도감")
	await _shot("3-dex")
	main.push("species", {"id": "sp_01"}, "개체 01")
	await _shot("4-species")
	main.go("creatures")
	main.go("creatures")
	main.push("creature", {"uid": "c1"}, "개체 01")
	await _shot("5-creature")
	main.go("explore")
	main.push("region", {"id": "region_01"}, "지역 1")
	await _shot("6-region")
	load("res://scripts/ui/screens/screens.gd")._do_survey(main, "region_01")
	await _shot("7-survey-result")
	main.close_sheet(null)
	main.go("planet")
	await _shot("8-planet")
	var scroll = main.find_child("Scroll", true, false)
	scroll.scroll_vertical = 100000
	await _shot("8b-planet-regions")
	scroll.scroll_vertical = 0
	main.find_child("PlanetView", true, false).region_pressed.emit("region_02")
	await _shot("8c-map-popup")
	main.close_sheet(null)
	main.find_child("PlanetView", true, false).region_pressed.emit("region_05")
	await _shot("8d-map-popup-locked")
	main.close_sheet(null)
	main.go("creatures")
	main.go("creatures")
	main.push("species", {"id": "sp_04"}, "개체 04")
	await _shot("9-species-locked")
	game.settings.theme = "dark"
	quit()
