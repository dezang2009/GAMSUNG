extends RefCounted
## Phase 2: 개체 데이터 · 도감 · 확보/중복 · 연구 단계 · 지역 조사 · 저장 변환

var t
var Game: Node
var Data: Node
var Save: Node


func before_each() -> void:
	Game = t.root.get_node("Game")
	Data = t.root.get_node("Data")
	Save = t.root.get_node("Save")
	Data.load_all("res://data/")
	Game.new_game()
	Game.state.seed = 12345


func after_each() -> void:
	Game.state = {}


func test_species_data() -> void:
	var all = Data.all("species")
	t.eq(all.size(), 20, "임시 개체 20종 (기본 15 + 진화형 5)")
	t.eq(all.filter(func(s): return int(s.evolution.stage) == 1).size(), 15, "기본(1단계) 15종")
	var branch = all.filter(func(s): return s.evolution.next.size() >= 2)
	t.ok(branch.size() >= 1, "분기 진화 개체가 있어요")
	for el in ["heat", "bio", "fluid", "mineral"]:
		t.ok(all.any(func(s): return s.element == el), "속성 '%s' 개체가 있어요" % el)
	for s in all:
		t.ok(s.get("placeholder", false), "미정 개체 '%s' 는 임시 표시" % s.id)


func test_every_species_obtainable() -> void:
	t.eq(DataSchema.unobtainable_species(Data.all("species"), Data.all("regions"), Data.meta.starting_creatures), [], "모든 개체에 얻는 경로가 있어요")
	var extra = Data.all("species").duplicate(true)
	extra.append({"id": "sp_99", "evolution": {"line": "x", "stage": 1, "next": []}})
	t.eq(DataSchema.unobtainable_species(extra, Data.all("regions"), Data.meta.starting_creatures), ["sp_99"], "경로가 없는 개체는 잡아내요")


func test_species_validation() -> void:
	var bad = {"id": "sp_x", "base_stats": {"hp": 10, "atk": -1, "luck": 3}, "evolution": {"line": "l", "stage": 1, "next": [{"to": "sp_03"}, {"to": "sp_nope"}]}}
	var errs = "\n".join(DataSchema.check_species(bad, Data.index))
	for needle in ["'def' 가 없어요", "'luck' 는 stats.json 에 없는", "atk 는 양의 정수", "진화 대상 'sp_nope' 가 없어요"]:
		t.ok(errs.contains(needle), "개체 검사: %s" % needle)
	var bad_r = {"id": "r", "surveys": 2, "encounters": [{"species": "sp_01", "method": "fly", "weight": 0, "from_survey": 5}]}
	var errs2 = "\n".join(DataSchema.check_encounters(bad_r, Data.index))
	for needle in ["만남 방법 'fly'", "weight 는 양수", "from_survey 는 1~2"]:
		t.ok(errs2.contains(needle), "만남 검사: %s" % needle)


func test_starters() -> void:
	t.eq(Game.state.collection.owned.map(func(x): return x.species), ["sp_01", "sp_02", "sp_03"], "시작 개체 3종 (설정 파일)")
	for it in Game.state.collection.owned:
		t.eq(it.level, 1, "Lv 1")
		t.eq(it.method, "start", "얻은 방법")
	t.eq(CollectionSystem.status(Game.state, "sp_01"), "owned", "확보 상태")
	t.eq(CollectionSystem.status(Game.state, "sp_04"), "unknown", "모르는 개체")


func test_duplicate_becomes_research_data() -> void:
	var before := CollectionSystem.research_points(Game.state, "sp_01")
	var r = CollectionSystem.acquire(Game.state, "sp_01", "egg", "region_01", 0)
	t.eq(r.kind, "duplicate", "같은 종을 또 얻으면 중복")
	t.eq(Game.state.collection.owned.size(), 3, "중복은 개체를 늘리지 않아요")
	t.eq(CollectionSystem.research_points(Game.state, "sp_01"), before + int(Data.research_config().duplicate), "연구 데이터로 전환")


func test_research_levels() -> void:
	var levels: Array = Data.research_config().levels
	t.eq(CollectionSystem.research_level(Game.state, "sp_04"), 0, "모르면 0단계")
	CollectionSystem.see(Game.state, "sp_04", 1)
	t.eq(CollectionSystem.status(Game.state, "sp_04"), "seen", "목격하면 도감 등록")
	t.eq(CollectionSystem.research_level(Game.state, "sp_04"), 1, "목격 1번 → 1단계")
	t.eq(CollectionSystem.next_level_need(Game.state, "sp_04"), int(levels[1]), "다음 단계 필요 점수")
	t.ok(not CollectionSystem.see(Game.state, "sp_04", 2), "두 번째 목격은 처음이 아님")
	CollectionSystem.acquire(Game.state, "sp_04", "egg", "", 3)
	t.eq(CollectionSystem.research_level(Game.state, "sp_04"), CollectionSystem.research_max(), "확보하면 최고 단계까지")
	t.eq(CollectionSystem.next_level_need(Game.state, "sp_04"), -1, "최고 단계")


func test_survey_rules_and_limits() -> void:
	var r1 = Data.get_item("regions", "region_01")
	var r2 = Data.get_item("regions", "region_02")
	t.ok(Game.survey_region("region_02").get("error", "").contains("열리지 않은"), "잠긴 지역은 조사 불가")
	var a = Game.survey_region("region_01")
	t.eq(a.survey, 1, "1차 조사")
	t.ok(a.results.size() >= 1 and a.results.all(func(x): return x.type == "sighting"), "1차: 야생 목격 (알은 2차부터)")
	var b = Game.survey_region("region_01")
	t.ok(b.results.any(func(x): return x.type == "egg" and x.species == "sp_03"), "2차: sp_03 알")
	var egg = b.results.filter(func(x): return x.type == "egg")[0]
	t.eq(egg.acquire.kind, "duplicate", "시작 개체와 같은 종의 알 → 연구 데이터")
	var c = Game.survey_region("region_01")
	t.ok(c.results.any(func(x): return x.species == "sp_05"), "3차: 새 서식지(sp_05) 반드시 목격")
	t.ok(Game.survey_region("region_01").get("error", "").contains("모두 마쳤어요"), "조사 횟수 끝")
	t.eq(ExplorationSystem.done(Game.state, "region_01"), int(r1.surveys), "조사 횟수 기록")
	t.ok(Game.state.log[0].text.contains("3차 조사"), "조사 기록")
	t.ok(r2 != null, "")


func test_survey_is_deterministic() -> void:
	var first = []
	for i in 3:
		first.append(Game.survey_region("region_01").results.map(func(x): return x.species))
	var seen_a = Game.state.collection.seen.duplicate()
	Game.new_game()
	Game.state.seed = 12345
	var second = []
	for i in 3:
		second.append(Game.survey_region("region_01").results.map(func(x): return x.species))
	t.eq(second, first, "같은 씨앗이면 같은 조사 결과")
	t.eq(Game.state.collection.seen.keys().size(), seen_a.keys().size(), "같은 도감")
	Game.new_game()
	Game.state.seed = 999
	var third = []
	for i in 3:
		third.append(Game.survey_region("region_01").results.map(func(x): return x.species))
	t.ok(third.size() == 3, "다른 씨앗도 조사 3번 완료")


func test_owned_filter_sort() -> void:
	var now := int(Time.get_unix_time_from_system())
	CollectionSystem.acquire(Game.state, "sp_15", "egg", "region_05", now + 100)
	CollectionSystem.acquire(Game.state, "sp_04", "egg", "region_02", now + 50)
	t.eq(CollectionSystem.owned_list(Game.state, "heat").map(func(x): return x.species), ["sp_15", "sp_01"], "열 속성만 (최근 순)")
	t.eq(CollectionSystem.owned_list(Game.state, "", "rarity")[0].species, "sp_15", "희귀도 높은 순")
	t.eq(CollectionSystem.counts(Game.state).owned, 5, "보유 5")


func test_evolution_line() -> void:
	t.eq(CollectionSystem.evolution_line("sp_01").map(func(s): return s.id), ["sp_01", "sp_16", "sp_17"], "분기 계통")
	t.eq(CollectionSystem.evolution_line("sp_20").map(func(s): return s.id), ["sp_03", "sp_19", "sp_20"], "3단계 계통")
	t.ok(CollectionSystem.evolution_only("sp_16"), "진화로만 얻는 개체")
	t.ok(not CollectionSystem.evolution_only("sp_05"), "야생에서 만나는 개체")


func test_v1_save_migrates() -> void:
	var v1 = Game.state.duplicate(true)
	v1.collection.erase("research")
	v1.erase("exploration")
	v1.erase("seed")
	var r = Save.parse_text(JSON.stringify({"app": "nexus", "version": 1, "data": v1}))
	t.ok(r.has("data"), "1버전 저장 → 2버전으로 변환")
	t.ok(r.data.collection.has("research") and r.data.has("exploration") and r.data.has("seed"), "새 칸 채움")
	t.eq(r.data.collection.owned.size(), 3, "기존 개체 유지")
