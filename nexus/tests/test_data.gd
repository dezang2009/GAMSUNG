extends RefCounted
## 설정 데이터: 실제 데이터는 오류 없음 · 속성 4종 확정 · 잘못된 데이터는 정확히 짚어 냄

var t
var Data: Node


func before_each() -> void:
	Data = t.root.get_node("Data")


func after_each() -> void:
	Data.load_all("res://data/")


func test_real_data_has_no_errors() -> void:
	t.eq(Data.load_all("res://data/"), 0, "실제 설정 데이터 오류 수 (%s)" % "; ".join(Data.errors))


func test_four_base_elements() -> void:
	var names = Data.all("elements").map(func(e): return e.name)
	t.eq(names, ["열", "생물", "유체", "광물"], "기본 속성 이름·순서")
	t.eq(Data.all("elements").map(func(e): return e.id), ["heat", "bio", "fluid", "mineral"], "속성 id")
	for e in Data.all("elements"):
		t.ok(not e.get("placeholder", false), "확정된 속성 '%s' 는 임시 표시가 없어야 해요" % e.name)


func test_affinity_is_undecided_neutral() -> void:
	t.eq(Data.affinity.get("placeholder"), true, "상성은 미정 표시")
	for a in ["heat", "bio", "fluid", "mineral"]:
		for d in ["heat", "bio", "fluid", "mineral"]:
			t.eq(Data.affinity_multiplier(a, d), 1.0, "상성 %s→%s 기본 1배" % [a, d])


func test_undecided_content_is_marked() -> void:
	for table in ["rarities", "roles", "resources", "planets", "regions"]:
		for it in Data.all(table):
			t.ok(it.get("placeholder", false), "%s '%s' 는 미정이라 placeholder 표시" % [table, it.id])
	t.ok(Data.placeholder_count() > 0, "임시 항목 수 집계")


func test_lookup() -> void:
	t.eq(Data.get_item("elements", "fluid").name, "유체", "id 로 찾기")
	t.ok(Data.get_item("elements", "nope").is_empty(), "없는 id 는 빈 값")
	t.eq(Data.regions_of("planet_01").size(), 5, "행성의 지역 5곳")


func test_bad_data_is_reported_precisely() -> void:
	var n: int = Data.load_all("res://tests/fixtures/bad_data/")
	var all = "\n".join(Data.errors)
	t.ok(n >= 7, "오류를 여러 개 찾아요 (%d개)" % n)
	for needle in ["resources.json: 파일이 없어요", "id 'heat' 가 두 번", "'color' 는 #rrggbb", "알 수 없는 칸 'extra'", "planet_99", "teleport", "상성표의 방어 속성 'water'"]:
		t.ok(all.contains(needle), "오류 문장에 '%s'" % needle)


func test_dead_end_region_detected() -> void:
	var regions = [
		{"id": "a", "unlock": {"any": [{"type": "start"}]}},
		{"id": "b", "unlock": {"all": [{"type": "region_cleared", "region": "c"}]}},
		{"id": "c", "unlock": {"all": [{"type": "region_cleared", "region": "b"}]}},
		{"id": "d", "unlock": {"any": [{"type": "region_cleared", "region": "b"}, {"type": "region_cleared", "region": "a"}]}},
	]
	t.eq(DataSchema.unreachable_regions(regions), ["b", "c"], "서로 기다리는 지역은 막다른 길, 대체 경로가 있는 d 는 통과")


func test_unlock_any_all() -> void:
	var any = {"any": [{"type": "region_cleared", "region": "x"}, {"type": "region_cleared", "region": "y"}]}
	var all = {"all": [{"type": "region_cleared", "region": "x"}, {"type": "region_cleared", "region": "y"}]}
	t.ok(not DataSchema.is_unlocked(any, {}), "any: 하나도 없으면 잠김")
	t.ok(DataSchema.is_unlocked(any, {"y": true}), "any: 하나만 있어도 열림")
	t.ok(not DataSchema.is_unlocked(all, {"y": true}), "all: 하나만 있으면 잠김")
	t.ok(DataSchema.is_unlocked(all, {"x": true, "y": true}), "all: 모두 있으면 열림")
